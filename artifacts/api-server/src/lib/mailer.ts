import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

let transporter: Transporter | null = null;

function envValue(...keys: string[]) {
  return keys.map((key) => process.env[key]).find((value) => value !== undefined && value !== "") ?? "";
}

export function mailConfigured() {
  return Boolean(
    envValue("SMTP_HOST") &&
      envValue("SMTP_USERNAME") &&
      envValue("SMTP_PASSWORD") &&
      envValue("MAIL_FROM_ADDRESS", "SMTP_USERNAME"),
  );
}

function getTransporter() {
  if (!mailConfigured()) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD and MAIL_FROM_ADDRESS.",
    );
  }
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: envValue("SMTP_HOST"),
      port,
      secure: process.env.SMTP_ENCRYPTION === "ssl" || port === 465,
      auth: {
        user: envValue("SMTP_USERNAME"),
        pass: envValue("SMTP_PASSWORD"),
      },
      connectionTimeout: Number(process.env.SMTP_TIMEOUT || 12000),
    });
  }
  return transporter;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendMail(to: string, subject: string, text: string, html: string) {
  if (!mailConfigured()) {
    logger.warn({ to, subject }, "Email notification skipped because SMTP is not configured");
    return false;
  }
  await getTransporter().sendMail({
    from: {
      address: envValue("MAIL_FROM_ADDRESS", "SMTP_USERNAME"),
      name: envValue("MAIL_FROM_NAME") || "Real World Link",
    },
    to,
    subject,
    text,
    html,
  });
  return true;
}

export async function sendAdminOtp(email: string, code: string) {
  return sendMail(
    email,
    "Your Real World Link admin passcode",
    `Your one-time Real World Link admin passcode is ${code}. It expires in 10 minutes and can only be used once.`,
    `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#203238"><h2>Real World Link admin access</h2><p>Your one-time passcode is:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">${escapeHtml(code)}</p><p>This code expires in 10 minutes and can only be used once.</p></div>`,
  );
}

export async function sendSubmissionConfirmation(input: {
  email: string;
  name: string;
  kind: "contact" | "assessment";
  trackingUrl?: string;
}) {
  const name = escapeHtml(input.name);
  const isAssessment = input.kind === "assessment";
  const trackingText = input.trackingUrl
    ? `\n\nTrack your Linking Box any time:\n${input.trackingUrl}\n\nKeep this link private — it opens your personal dashboard.`
    : "";
  const trackingHtml = input.trackingUrl
    ? `<p>Track your Linking Box any time:</p><p><a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;padding:11px 20px;background:#237567;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Open my dashboard</a></p><p style="font-size:13px;color:#5a6b70">Keep this link private — it opens your personal dashboard.</p>`
    : "";
  return sendMail(
    input.email,
    isAssessment ? "Your Real World Link assessment was received" : "Your message to Real World Link was received",
    `Hi ${input.name}, we received your ${isAssessment ? "assessment" : "message"}. Aafiya and Sana will connect with you within 48 hours.${trackingText}`,
    `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#203238"><h2>Thank you, ${name}.</h2><p>We received your ${isAssessment ? "career assessment" : "message"}.</p><p>Aafiya and Sana will connect with you within 48 hours.</p>${trackingHtml}<p>With care,<br />Real World Link</p></div>`,
  );
}

const boxStatusCopy: Record<string, { subject: string; line: string }> = {
  preparing: {
    subject: "Your Linking Box is being prepared",
    line: "We are putting your Linking Box together based on your assessment result.",
  },
  designed: {
    subject: "Your Linking Box is ready and packed",
    line: "Your Linking Box has been designed for your career field and is packed, ready to leave our workshop.",
  },
  dispatched: {
    subject: "Your Linking Box is on the way",
    line: "Your Linking Box has been dispatched and is on its way to you.",
  },
  delivered: {
    subject: "Your Linking Box has been delivered",
    line: "Your Linking Box has been delivered. Open it up and start your practical challenge whenever you are ready.",
  },
};

export async function sendBoxStatusUpdate(input: {
  email: string;
  name: string;
  status: string;
  expectedDeliveryOn?: string | null;
  trackingUrl?: string;
}) {
  const copy = boxStatusCopy[input.status];
  if (!copy) {
    logger.warn({ status: input.status }, "Box status email skipped for an unknown status");
    return false;
  }
  const expectedText = input.expectedDeliveryOn ? `\nExpected delivery: ${input.expectedDeliveryOn}` : "";
  const expectedHtml = input.expectedDeliveryOn
    ? `<p><strong>Expected delivery:</strong> ${escapeHtml(input.expectedDeliveryOn)}</p>`
    : "";
  const trackingHtml = input.trackingUrl
    ? `<p><a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;padding:11px 20px;background:#237567;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Track my box</a></p>`
    : "";
  return sendMail(
    input.email,
    copy.subject,
    `Hi ${input.name}, ${copy.line}${expectedText}${input.trackingUrl ? `\n\nTrack it here:\n${input.trackingUrl}` : ""}`,
    `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#203238"><h2>Hi ${escapeHtml(input.name)},</h2><p>${copy.line}</p>${expectedHtml}${trackingHtml}<p>With care,<br />Real World Link</p></div>`,
  );
}

export async function sendAdminNotification(input: {
  subject: string;
  text: string;
}) {
  const adminEmail = envValue("MAIL_ADMIN_ADDRESS");
  if (!adminEmail) {
    logger.warn("Admin notification skipped because MAIL_ADMIN_ADDRESS is not configured");
    return false;
  }
  return sendMail(
    adminEmail,
    input.subject,
    input.text,
    `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#203238"><h2>${escapeHtml(input.subject)}</h2><p>${escapeHtml(input.text).replaceAll("\n", "<br />")}</p></div>`,
  );
}
