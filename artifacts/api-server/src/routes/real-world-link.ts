import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { databaseConfigured, getPool } from "../lib/mysql";
import {
  mailConfigured,
  sendAdminNotification,
  sendAdminOtp,
  sendSubmissionConfirmation,
} from "../lib/mailer";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const SESSION_COOKIE = "rwl_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;

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
    const [insertResult] = await db.execute<ResultSetHeader>(
      "INSERT INTO rwl_assessment_submissions (name, email, grade, city, school, stream, result, answers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [name, email, grade, city, school, stream, result || null, JSON.stringify(answers)],
    );
    const notifications = await Promise.allSettled([
      sendSubmissionConfirmation({ email, name, kind: "assessment" }),
      sendAdminNotification({
        subject: `New ${stream} assessment from ${name}`,
        text: `${name} (${email}) completed a ${stream} assessment.\nGrade: ${grade}\nCity: ${city}\nSchool: ${school || "Not provided"}\nResult: ${result || "Not recorded"}`,
      }),
    ]);
    notifications.forEach((notification) => {
      if (notification.status === "rejected") logger.error({ err: notification.reason }, "Assessment email notification failed");
    });
    res.status(201).json({ ok: true, id: Number(insertResult.insertId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assessment could not be saved.";
    res.status(message.includes("required") || message.includes("valid") || message.includes("too long") ? 400 : 500).json({ message });
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
        "SELECT id, name, email, grade, city, school, stream, result, answers, status, notes, created_at, updated_at FROM rwl_assessment_submissions ORDER BY created_at DESC LIMIT 500",
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