import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { databaseConfigured, getPool } from "../lib/mysql";
import {
  mailConfigured,
  sendAdminNotification,
  sendAdminOtp,
  sendBoxStatusUpdate,
  sendSubmissionConfirmation,
} from "../lib/mailer";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const SESSION_COOKIE = "rwl_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const BOX_STATUSES = ["preparing", "designed", "dispatched", "delivered"] as const;

// Columns the student dashboard and the admin workspace both read.
const ASSESSMENT_COLUMNS = `id, name, email, grade, city, school, stream, result, answers, status, notes,
  phone, address_line, state, pincode, tracking_code, box_status, dispatched_at, expected_delivery_on,
  delivered_at, mentor_name, mentor_phone, challenge_notes, challenge_submitted_at, mentor_feedback,
  mentor_feedback_at, created_at, updated_at`;

type AuthenticatedRequest = Request & { adminEmail?: string };
type DatabaseRow = RowDataPacket & Record<string, unknown>;

function envValue(...keys: string[]) {
  return keys.map((key) => process.env[key]).find((value) => value !== undefined && value !== "") ?? "";
}

function normalizedEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function adminEmailSet() {
  return new Set(
    envValue("ADMIN_EMAILS")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function signedSessionValue(token: string) {
  const secret = envValue("SESSION_SECRET");
  if (!secret) throw new Error("SESSION_SECRET is not configured.");
  return `${token}.${createHmac("sha256", secret).update(token).digest("hex")}`;
}

function verifiedSessionToken(value: unknown) {
  if (typeof value !== "string") return null;
  const [token, signature] = value.split(".");
  const secret = envValue("SESSION_SECRET");
  if (!token || !signature || !secret) return null;
  const expected = createHmac("sha256", secret).update(token).digest("hex");
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  return token;
}

function requireDatabase(res: Response) {
  if (databaseConfigured()) return getPool();
  res.status(503).json({
    message: "Database is not configured. Set MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER and MYSQL_PASSWORD.",
  });
  return null;
}

function readText(value: unknown, field: string, maxLength: number, required = true) {
  if (typeof value !== "string") {
    if (!required && (value === undefined || value === null)) return "";
    throw new Error(`${field} is required.`);
  }
  const text = value.trim();
  if (required && !text) throw new Error(`${field} is required.`);
  if (text.length > maxLength) throw new Error(`${field} is too long.`);
  return text;
}

function readEmail(value: unknown) {
  const email = normalizedEmail(value);
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

function readPhone(value: unknown, required = true) {
  const raw = readText(value, "Phone number", 32, required);
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 10 || digits.length > 15) throw new Error("Enter a valid phone number.");
  return raw;
}

function readPincode(value: unknown, required = true) {
  const raw = readText(value, "PIN code", 12, required);
  if (!raw) return "";
  if (!/^\d{4,10}$/.test(raw)) throw new Error("Enter a valid PIN code.");
  return raw;
}

// Optional YYYY-MM-DD date used for the expected delivery day.
function readDateOnly(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  const raw = readText(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${field} must use the YYYY-MM-DD format.`);
  if (Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) throw new Error(`${field} is not a real date.`);
  return raw;
}

// A 10-digit numeric code is short enough for a student to read off an email
// and type by hand. It is drawn at random rather than counted up, so one code
// never reveals another, and lookups are rate limited below.
function newTrackingCode() {
  return String(randomInt(1_000_000_000, 10_000_000_000));
}

// The tracking code is the only credential on the student dashboard, so failed
// lookups are throttled per IP to keep guessing impractical.
const TRACK_WINDOW_MS = 60 * 1000;
const TRACK_MAX_FAILURES = 10;
const trackFailures = new Map<string, { count: number; resetAt: number }>();

function trackLookupBlocked(ip: string) {
  const entry = trackFailures.get(ip);
  if (!entry || entry.resetAt <= Date.now()) return false;
  return entry.count >= TRACK_MAX_FAILURES;
}

function recordTrackFailure(ip: string) {
  const now = Date.now();
  const entry = trackFailures.get(ip);
  if (!entry || entry.resetAt <= now) {
    trackFailures.set(ip, { count: 1, resetAt: now + TRACK_WINDOW_MS });
    return;
  }
  entry.count += 1;
  // Opportunistic cleanup so the map cannot grow without bound.
  if (trackFailures.size > 5000) {
    for (const [key, value] of trackFailures) {
      if (value.resetAt <= now) trackFailures.delete(key);
    }
  }
}

function publicBaseUrl() {
  return envValue("PUBLIC_BASE_URL").replace(/\/+$/, "");
}

function trackingUrl(code: string) {
  const base = publicBaseUrl();
  return base ? `${base}/track?code=${encodeURIComponent(code)}` : undefined;
}

// Serialises one assessment row for the student's own dashboard. Deliberately
// omits admin-only fields such as internal notes.
function studentDashboardPayload(row: DatabaseRow) {
  return {
    name: String(row.name),
    stream: String(row.stream),
    result: row.result ? String(row.result) : null,
    trackingCode: String(row.tracking_code),
    box: {
      status: String(row.box_status),
      dispatchedAt: row.dispatched_at ?? null,
      expectedDeliveryOn: row.expected_delivery_on ?? null,
      deliveredAt: row.delivered_at ?? null,
    },
    address: {
      line: String(row.address_line || ""),
      city: String(row.city || ""),
      state: String(row.state || ""),
      pincode: String(row.pincode || ""),
      phone: String(row.phone || ""),
    },
    mentor: {
      name: String(row.mentor_name || ""),
      phone: String(row.mentor_phone || ""),
    },
    challenge: {
      notes: row.challenge_notes ? String(row.challenge_notes) : null,
      submittedAt: row.challenge_submitted_at ?? null,
      feedback: row.mentor_feedback ? String(row.mentor_feedback) : null,
      feedbackAt: row.mentor_feedback_at ?? null,
    },
  };
}

function setSessionCookie(res: Response, value: string) {
  res.cookie(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const db = requireDatabase(res);
  if (!db) return;
  const token = verifiedSessionToken(req.cookies?.[SESSION_COOKIE]);
  if (!token) {
    res.status(401).json({ message: "Admin authentication is required." });
    return;
  }
  try {
    const [rows] = await db.execute<DatabaseRow[]>(
      "SELECT email FROM rwl_admin_sessions WHERE session_hash = ? AND expires_at > UTC_TIMESTAMP(3) LIMIT 1",
      [hashValue(token)],
    );
    if (rows.length === 0) {
      res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
      res.status(401).json({ message: "Your admin session has expired. Please sign in again." });
      return;
    }
    req.adminEmail = String(rows[0].email);
    next();
  } catch (error) {
    next(error);
  }
}

router.post("/public/contact", async (req, res) => {
  const db = requireDatabase(res);
  if (!db) return;
  try {
    const name = readText(req.body?.name, "Name", 120);
    const email = readEmail(req.body?.email);
    const subject = readText(req.body?.subject, "Subject", 200);
    const message = readText(req.body?.message, "Message", 5000);
    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO rwl_contact_submissions (name, email, subject, message) VALUES (?, ?, ?, ?)",
      [name, email, subject, message],
    );
    const notifications = await Promise.allSettled([
      sendSubmissionConfirmation({ email, name, kind: "contact" }),
      sendAdminNotification({
        subject: `New contact message from ${name}`,
        text: `${name} (${email}) wrote:\n\n${subject}\n\n${message}`,
      }),
    ]);
    notifications.forEach((notification) => {
      if (notification.status === "rejected") logger.error({ err: notification.reason }, "Contact email notification failed");
    });
    res.status(201).json({ ok: true, id: Number(result.insertId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Contact message could not be saved.";
    res.status(message.includes("required") || message.includes("valid") || message.includes("too long") ? 400 : 500).json({ message });
  }
});

router.post("/public/assessment", async (req, res) => {
  const db = requireDatabase(res);
  if (!db) return;
  try {
    const name = readText(req.body?.name, "Name", 120);
    const email = readEmail(req.body?.email);
    const grade = readText(req.body?.grade, "Grade", 80);
    const city = readText(req.body?.city, "City", 120);
    const school = readText(req.body?.school, "School", 200, false);
    const stream = readText(req.body?.stream, "Stream", 20);
    if (!["PCB", "PCM", "Commerce", "Humanities"].includes(stream)) throw new Error("Choose a valid stream.");
    const result = readText(req.body?.result, "Result", 255, false);
    const answers = req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : {};
    // Delivery details for the Linking Box.
    const phone = readPhone(req.body?.phone);
    const addressLine = readText(req.body?.address, "Address", 255);
    const state = readText(req.body?.state, "State", 120);
    const pincode = readPincode(req.body?.pincode);
    // Retry on the (very unlikely) chance a code is already taken.
    let trackingCode = "";
    let insertResult: ResultSetHeader | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      trackingCode = newTrackingCode();
      try {
        const [inserted] = await db.execute<ResultSetHeader>(
          `INSERT INTO rwl_assessment_submissions
            (name, email, grade, city, school, stream, result, answers, phone, address_line, state, pincode, tracking_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [name, email, grade, city, school, stream, result || null, JSON.stringify(answers), phone, addressLine, state, pincode, trackingCode],
        );
        insertResult = inserted;
        break;
      } catch (error) {
        const duplicate = (error as { code?: string }).code === "ER_DUP_ENTRY";
        if (!duplicate || attempt === 4) throw error;
      }
    }
    if (!insertResult) throw new Error("Assessment could not be saved.");
    const notifications = await Promise.allSettled([
      sendSubmissionConfirmation({ email, name, kind: "assessment", trackingUrl: trackingUrl(trackingCode) }),
      sendAdminNotification({
        subject: `New ${stream} assessment from ${name}`,
        text: `${name} (${email}) completed a ${stream} assessment.\nGrade: ${grade}\nResult: ${result || "Not recorded"}\nSchool: ${school || "Not provided"}\nPhone: ${phone}\nShip to: ${addressLine}, ${city}, ${state} ${pincode}`,
      }),
    ]);
    notifications.forEach((notification) => {
      if (notification.status === "rejected") logger.error({ err: notification.reason }, "Assessment email notification failed");
    });
    res.status(201).json({ ok: true, id: Number(insertResult.insertId), trackingCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assessment could not be saved.";
    res.status(message.includes("required") || message.includes("valid") || message.includes("too long") ? 400 : 500).json({ message });
  }
});

// The student's own dashboard. The tracking code in the URL is the credential,
// so it is compared in full and never guessable (128 bits of randomness).
router.get("/public/track/:code", async (req, res) => {
  const db = requireDatabase(res);
  if (!db) return;
  const clientIp = req.ip ?? "unknown";
  if (trackLookupBlocked(clientIp)) {
    res.status(429).json({ message: "Too many attempts. Please wait a minute and try again." });
    return;
  }
  const code = String(req.params.code || "");
  if (!/^[A-Za-z0-9_-]{10,32}$/.test(code)) {
    recordTrackFailure(clientIp);
    res.status(404).json({ message: "That tracking code was not found." });
    return;
  }
  try {
    const [rows] = await db.execute<DatabaseRow[]>(
      `SELECT ${ASSESSMENT_COLUMNS} FROM rwl_assessment_submissions WHERE tracking_code = ? LIMIT 1`,
      [code],
    );
    if (rows.length === 0) {
      recordTrackFailure(clientIp);
      res.status(404).json({ message: "That tracking code was not found." });
      return;
    }
    res.json(studentDashboardPayload(rows[0]));
  } catch (error) {
    logger.error({ err: error }, "Student dashboard could not load");
    res.status(500).json({ message: "Your dashboard could not load." });
  }
});

// Student turns in their practical challenge from their dashboard.
router.post("/public/track/:code/challenge", async (req, res) => {
  const db = requireDatabase(res);
  if (!db) return;
  const code = String(req.params.code || "");
  if (!/^[A-Za-z0-9_-]{10,32}$/.test(code)) {
    res.status(404).json({ message: "That tracking code was not found." });
    return;
  }
  try {
    const notes = readText(req.body?.notes, "Your notes", 5000);
    const [rows] = await db.execute<DatabaseRow[]>(
      "SELECT id, name, email, result FROM rwl_assessment_submissions WHERE tracking_code = ? LIMIT 1",
      [code],
    );
    const record = rows[0];
    if (!record) {
      res.status(404).json({ message: "That tracking code was not found." });
      return;
    }
    await db.execute(
      "UPDATE rwl_assessment_submissions SET challenge_notes = ?, challenge_submitted_at = UTC_TIMESTAMP(3) WHERE id = ?",
      [notes, record.id],
    );
    sendAdminNotification({
      subject: `Challenge turned in by ${String(record.name)}`,
      text: `${String(record.name)} (${String(record.email)}) submitted their practical challenge for ${String(record.result || "their career field")}.\n\n${notes}`,
    }).catch((error) => logger.error({ err: error }, "Challenge notification failed"));
    res.status(201).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Your challenge could not be saved.";
    res.status(message.includes("required") || message.includes("too long") ? 400 : 500).json({ message });
  }
});

router.get("/public/settings", async (_req, res) => {
  if (!databaseConfigured()) {
    res.json({ settings: {} });
    return;
  }
  try {
    const db = getPool();
    const [rows] = await db.query<DatabaseRow[]>("SELECT setting_key, setting_value FROM rwl_site_settings");
    const settings = Object.fromEntries(rows.map((row) => [String(row.setting_key), String(row.setting_value)]));
    res.json({ settings });
  } catch (error) {
    logger.error({ err: error }, "Public settings could not load");
    res.json({ settings: {} });
  }
});

router.post("/admin/request-otp", async (req, res) => {
  const db = requireDatabase(res);
  if (!db) return;
  try {
    const email = readEmail(req.body?.email);
    if (adminEmailSet().size === 0) {
      res.status(503).json({ message: "Admin access is not configured. Set ADMIN_EMAILS first." });
      return;
    }
    if (!adminEmailSet().has(email)) {
      res.status(403).json({ message: "This email is not approved for the admin workspace." });
      return;
    }
    if (!mailConfigured()) {
      res.status(503).json({ message: "OTP email is not configured. Set the SMTP environment variables first." });
      return;
    }
    const [recent] = await db.execute<DatabaseRow[]>(
      "SELECT COUNT(*) AS count FROM rwl_admin_otp_challenges WHERE email = ? AND created_at > UTC_TIMESTAMP(3) - INTERVAL 15 MINUTE",
      [email],
    );
    if (Number(recent[0]?.count ?? 0) >= 5) {
      res.status(429).json({ message: "Too many passcode requests. Please wait a few minutes and try again." });
      return;
    }
    const code = String(randomInt(100000, 1000000));
    await db.execute(
      "INSERT INTO rwl_admin_otp_challenges (email, code_hash, expires_at) VALUES (?, ?, ?)",
      [email, hashValue(code), new Date(Date.now() + OTP_TTL_MS)],
    );
    try {
      await sendAdminOtp(email, code);
    } catch (error) {
      logger.error({ err: error }, "Admin OTP email failed");
      res.status(503).json({ message: "The passcode email could not be sent. Check SMTP settings." });
      return;
    }
    res.status(202).json({ message: "A one-time passcode has been sent to your email." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Passcode could not be requested.";
    res.status(400).json({ message });
  }
});

router.post("/admin/verify-otp", async (req, res) => {
  const db = requireDatabase(res);
  if (!db) return;
  try {
    const email = readEmail(req.body?.email);
    const code = readText(req.body?.code, "Passcode", 6);
    if (!/^\d{6}$/.test(code)) throw new Error("Enter the six-digit passcode.");
    const [rows] = await db.execute<DatabaseRow[]>(
      "SELECT id, code_hash, attempts FROM rwl_admin_otp_challenges WHERE email = ? AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP(3) ORDER BY id DESC LIMIT 1",
      [email],
    );
    const challenge = rows[0];
    if (!challenge || Number(challenge.attempts) >= 5) {
      res.status(400).json({ message: "That passcode is invalid or expired." });
      return;
    }
    const expectedBuffer = Buffer.from(String(challenge.code_hash), "utf8");
    const actualBuffer = Buffer.from(hashValue(code), "utf8");
    const matches = expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
    if (!matches) {
      await db.execute(
        "UPDATE rwl_admin_otp_challenges SET attempts = attempts + 1, consumed_at = IF(attempts + 1 >= 5, UTC_TIMESTAMP(3), consumed_at) WHERE id = ?",
        [challenge.id],
      );
      res.status(400).json({ message: "That passcode is invalid or expired." });
      return;
    }
    await db.execute("UPDATE rwl_admin_otp_challenges SET consumed_at = UTC_TIMESTAMP(3) WHERE id = ?", [challenge.id]);
    const token = randomBytes(32).toString("base64url");
    await db.execute(
      "INSERT INTO rwl_admin_sessions (session_hash, email, expires_at) VALUES (?, ?, ?)",
      [hashValue(token), email, new Date(Date.now() + SESSION_TTL_MS)],
    );
    setSessionCookie(res, signedSessionValue(token));
    res.json({ admin: { email } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Passcode could not be verified.";
    res.status(400).json({ message });
  }
});

router.get("/admin/session", async (req, res) => {
  const db = requireDatabase(res);
  if (!db) return;
  const token = verifiedSessionToken(req.cookies?.[SESSION_COOKIE]);
  if (!token) {
    res.json({ authenticated: false });
    return;
  }
  try {
    const [rows] = await db.execute<DatabaseRow[]>(
      "SELECT email FROM rwl_admin_sessions WHERE session_hash = ? AND expires_at > UTC_TIMESTAMP(3) LIMIT 1",
      [hashValue(token)],
    );
    if (rows.length === 0) {
      res.json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, admin: { email: String(rows[0].email) } });
  } catch (error) {
    res.status(500).json({ message: "Admin session could not be checked." });
  }
});

router.post("/admin/logout", async (req, res) => {
  const db = requireDatabase(res);
  if (!db) return;
  const token = verifiedSessionToken(req.cookies?.[SESSION_COOKIE]);
  if (token) await db.execute("DELETE FROM rwl_admin_sessions WHERE session_hash = ?", [hashValue(token)]);
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  res.json({ ok: true });
});

router.get("/admin/submissions", requireAdmin, async (req: AuthenticatedRequest, res) => {
  const db = getPool();
  const type = req.query.type === "contact" || req.query.type === "assessment" ? req.query.type : "all";
  try {
    const contacts: Record<string, unknown>[] = [];
    const assessments: Record<string, unknown>[] = [];
    if (type === "all" || type === "contact") {
      const [rows] = await db.query<DatabaseRow[]>(
        "SELECT id, name, email, subject, message, status, notes, created_at, updated_at FROM rwl_contact_submissions ORDER BY created_at DESC LIMIT 500",
      );
      contacts.push(...rows.map((row) => ({ ...row, id: Number(row.id) })));
    }
    if (type === "all" || type === "assessment") {
      const [rows] = await db.query<DatabaseRow[]>(
        `SELECT ${ASSESSMENT_COLUMNS} FROM rwl_assessment_submissions ORDER BY created_at DESC LIMIT 500`,
      );
      assessments.push(...rows.map((row) => ({
        ...row,
        id: Number(row.id),
        answers: typeof row.answers === "string" ? JSON.parse(row.answers) : row.answers,
      })));
    }
    res.json({ contacts, assessments });
  } catch (error) {
    logger.error({ err: error }, "Admin submissions could not load");
    res.status(500).json({ message: "Submissions could not load." });
  }
});

router.patch("/admin/submissions/:kind/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
  const db = getPool();
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ message: "Invalid submission id." });
    return;
  }
  const kind = req.params.kind;
  const contactStatuses = ["new", "in_progress", "resolved"];
  const assessmentStatuses = ["new", "reviewed", "contacted"];
  const allowed = kind === "contact" ? contactStatuses : kind === "assessment" ? assessmentStatuses : [];
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  if (!allowed.includes(status)) {
    res.status(400).json({ message: "Invalid submission status." });
    return;
  }
  const notes = req.body?.notes === null || req.body?.notes === undefined ? null : readText(req.body.notes, "Notes", 5000, false);
  try {
    const table = kind === "contact" ? "rwl_contact_submissions" : "rwl_assessment_submissions";
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE ${table} SET status = ?, notes = ? WHERE id = ?`,
      [status, notes || null, id],
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ message: "Submission not found." });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Submission changes could not be saved." });
  }
});

// Linking Box: delivery status, dates, assigned mentor and mentor feedback.
// A change of box status emails the student.
router.patch("/admin/box/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
  const db = getPool();
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ message: "Invalid submission id." });
    return;
  }
  try {
    const [existingRows] = await db.execute<DatabaseRow[]>(
      "SELECT id, name, email, box_status, tracking_code, mentor_feedback FROM rwl_assessment_submissions WHERE id = ? LIMIT 1",
      [id],
    );
    const existing = existingRows[0];
    if (!existing) {
      res.status(404).json({ message: "Submission not found." });
      return;
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let nextStatus: string | null = null;

    if (req.body?.boxStatus !== undefined) {
      const status = String(req.body.boxStatus);
      if (!BOX_STATUSES.includes(status as (typeof BOX_STATUSES)[number])) {
        res.status(400).json({ message: "Invalid box status." });
        return;
      }
      if (status !== String(existing.box_status)) nextStatus = status;
      updates.push("box_status = ?");
      values.push(status);
      // Stamp the lifecycle dates automatically the first time each step is reached.
      if (status === "dispatched") updates.push("dispatched_at = COALESCE(dispatched_at, UTC_TIMESTAMP(3))");
      if (status === "delivered") {
        updates.push("dispatched_at = COALESCE(dispatched_at, UTC_TIMESTAMP(3))");
        updates.push("delivered_at = COALESCE(delivered_at, UTC_TIMESTAMP(3))");
      }
    }
    if (req.body?.expectedDeliveryOn !== undefined) {
      updates.push("expected_delivery_on = ?");
      values.push(readDateOnly(req.body.expectedDeliveryOn, "Expected delivery date"));
    }
    if (req.body?.dispatchedOn !== undefined) {
      const dispatched = readDateOnly(req.body.dispatchedOn, "Dispatch date");
      updates.push("dispatched_at = ?");
      values.push(dispatched ? `${dispatched} 00:00:00.000` : null);
    }
    if (req.body?.mentorName !== undefined) {
      updates.push("mentor_name = ?");
      values.push(readText(req.body.mentorName, "Mentor name", 120, false));
    }
    if (req.body?.mentorPhone !== undefined) {
      updates.push("mentor_phone = ?");
      values.push(readPhone(req.body.mentorPhone, false));
    }
    if (req.body?.mentorFeedback !== undefined) {
      const feedback = readText(req.body.mentorFeedback, "Feedback", 5000, false);
      updates.push("mentor_feedback = ?");
      values.push(feedback || null);
      updates.push(feedback ? "mentor_feedback_at = UTC_TIMESTAMP(3)" : "mentor_feedback_at = NULL");
    }

    if (updates.length === 0) {
      res.status(400).json({ message: "Nothing to update." });
      return;
    }

    values.push(id);
    await db.execute(`UPDATE rwl_assessment_submissions SET ${updates.join(", ")} WHERE id = ?`, values);

    const [refreshed] = await db.execute<DatabaseRow[]>(
      `SELECT ${ASSESSMENT_COLUMNS} FROM rwl_assessment_submissions WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = refreshed[0];

    if (nextStatus && row) {
      const expected = row.expected_delivery_on;
      sendBoxStatusUpdate({
        email: String(row.email),
        name: String(row.name),
        status: nextStatus,
        expectedDeliveryOn: expected ? new Date(String(expected)).toISOString().slice(0, 10) : null,
        trackingUrl: row.tracking_code ? trackingUrl(String(row.tracking_code)) : undefined,
      }).catch((error) => logger.error({ err: error, id }, "Box status email failed"));
    }

    res.json({
      ok: true,
      assessment: row ? { ...row, id: Number(row.id), answers: typeof row.answers === "string" ? JSON.parse(row.answers) : row.answers } : null,
      emailQueued: Boolean(nextStatus),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Linking Box changes could not be saved.";
    res.status(message.includes("valid") || message.includes("format") || message.includes("too long") || message.includes("real date") ? 400 : 500).json({ message });
  }
});

router.get("/admin/settings", requireAdmin, async (_req: AuthenticatedRequest, res) => {
  const db = getPool();
  try {
    const [rows] = await db.query<DatabaseRow[]>("SELECT setting_key, setting_value FROM rwl_site_settings ORDER BY setting_key ASC");
    const settings = Object.fromEntries(rows.map((row) => [String(row.setting_key), String(row.setting_value)]));
    res.json({ settings });
  } catch (error) {
    res.status(500).json({ message: "Settings could not load." });
  }
});

router.put("/admin/settings", requireAdmin, async (req: AuthenticatedRequest, res) => {
  const db = getPool();
  const input = req.body?.settings;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    res.status(400).json({ message: "Settings must be an object." });
    return;
  }
  const settings = Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => /^[a-zA-Z0-9_.-]{1,120}$/.test(key) && typeof value === "string")
      .map(([key, value]) => [key, String(value).slice(0, 10000)]),
  );
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM rwl_site_settings");
    for (const [key, value] of Object.entries(settings)) {
      await connection.execute("INSERT INTO rwl_site_settings (setting_key, setting_value) VALUES (?, ?)", [key, value]);
    }
    await connection.commit();
    res.json({ settings });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: "Settings could not be saved." });
  } finally {
    connection.release();
  }
});

export default router;