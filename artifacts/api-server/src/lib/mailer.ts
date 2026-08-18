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
}) {
  const name = escapeHtml(input.name);
  const isAssessment = input.kind === "assessment";
  return sendMail(
    input.email,
    isAssessment ? "Your Real World Link assessment was received" : "Your message to Real World Link was received",
    `Hi ${input.name}, we received your ${isAssessment ? "assessment" : "message"}. Aafiya and Sana will connect with you within 48 hours.`,
    `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#203238"><h2>Thank you, ${name}.</h2><p>We received your ${isAssessment ? "career assessment" : "message"}.</p><p>Aafiya and Sana will connect with you within 48 hours.</p><p>With care,<br />Real World Link</p></div>`,
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
