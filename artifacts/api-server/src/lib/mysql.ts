import mysql, { type Pool } from "mysql2/promise";
import { logger } from "./logger";

let pool: Pool | null = null;

function envValue(...keys: string[]) {
  return keys.map((key) => process.env[key]).find((value) => value !== undefined && value !== "") ?? "";
}

export function databaseConfigured() {
  return Boolean(
    envValue("MYSQL_HOST", "DB_HOST") &&
      envValue("MYSQL_DATABASE", "DB_NAME") &&
      envValue("MYSQL_USER", "DB_USER") &&
      envValue("MYSQL_PASSWORD", "DB_PASS"),
  );
}

export function getPool() {
  if (!databaseConfigured()) {
    throw new Error(
      "MySQL is not configured. Set MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER and MYSQL_PASSWORD.",
    );
  }
  if (!pool) {
    pool = mysql.createPool({
      host: envValue("MYSQL_HOST", "DB_HOST"),
      port: Number(envValue("MYSQL_PORT", "DB_PORT") || 3306),
      database: envValue("MYSQL_DATABASE", "DB_NAME"),
      user: envValue("MYSQL_USER", "DB_USER"),
      password: envValue("MYSQL_PASSWORD", "DB_PASS"),
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 8),
      timezone: "Z",
      enableKeepAlive: true,
    });
  }
  return pool;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS rwl_contact_submissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(320) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('new', 'in_progress', 'resolved') NOT NULL DEFAULT 'new',
    notes TEXT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_rwl_contact_created (created_at),
    INDEX idx_rwl_contact_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS rwl_assessment_submissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(320) NOT NULL,
    grade VARCHAR(80) NOT NULL,
    city VARCHAR(120) NOT NULL,
    school VARCHAR(200) NOT NULL DEFAULT '',
    stream ENUM('PCB', 'PCM', 'Commerce', 'Humanities') NOT NULL,
    result VARCHAR(255) NULL,
    answers JSON NOT NULL,
    status ENUM('new', 'reviewed', 'contacted') NOT NULL DEFAULT 'new',
    notes TEXT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_rwl_assessment_created (created_at),
    INDEX idx_rwl_assessment_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS rwl_admin_otp_challenges (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(320) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    consumed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_rwl_otp_email_created (email, created_at),
    INDEX idx_rwl_otp_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS rwl_admin_sessions (
    session_hash CHAR(64) NOT NULL,
    email VARCHAR(320) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (session_hash),
    INDEX idx_rwl_session_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS rwl_site_settings (
    setting_key VARCHAR(120) NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (setting_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `INSERT IGNORE INTO rwl_site_settings (setting_key, setting_value) VALUES
    ('site_name', 'Real World Link'),
    ('site_tagline', 'Discover Your Potential. Find Your Path.'),
    ('site_subbrand', 'In Shorts by Aafiya & Sana'),
    ('hero_title', 'Discover your potential. Find your path.'),
    ('hero_description', 'Explore your interests, understand your strengths and discover career fields that may be a strong fit for you.'),
    ('contact_reply_window', 'We will keep the conversation clear and student-friendly.')`,
];

export async function initializeDatabase() {
  if (!databaseConfigured()) {
    logger.warn(
      "MySQL is not configured; public submissions and admin workspace are disabled until database environment variables are set.",
    );
    return;
  }
  const db = getPool();
  for (const statement of schemaStatements) {
    await db.query(statement);
  }
  await db.query("DELETE FROM rwl_admin_otp_challenges WHERE expires_at < UTC_TIMESTAMP(3)");
  await db.query("DELETE FROM rwl_admin_sessions WHERE expires_at < UTC_TIMESTAMP(3)");
  logger.info("MySQL schema is ready");
}
