import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
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

// Columns added after the first release. Applied with ALTER so existing
// installations pick them up without losing data.
const addedColumns: { table: string; column: string; definition: string }[] = [
  // Delivery address details for the Linking Box.
  { table: "rwl_assessment_submissions", column: "phone", definition: "VARCHAR(32) NOT NULL DEFAULT ''" },
  { table: "rwl_assessment_submissions", column: "address_line", definition: "VARCHAR(255) NOT NULL DEFAULT ''" },
  { table: "rwl_assessment_submissions", column: "state", definition: "VARCHAR(120) NOT NULL DEFAULT ''" },
  { table: "rwl_assessment_submissions", column: "pincode", definition: "VARCHAR(12) NOT NULL DEFAULT ''" },
  // Secret code that lets a student open their own tracking dashboard.
  { table: "rwl_assessment_submissions", column: "tracking_code", definition: "VARCHAR(32) NULL" },
  // Linking Box delivery lifecycle.
  {
    table: "rwl_assessment_submissions",
    column: "box_status",
    definition: "ENUM('preparing', 'designed', 'dispatched', 'delivered') NOT NULL DEFAULT 'preparing'",
  },
  { table: "rwl_assessment_submissions", column: "dispatched_at", definition: "DATETIME(3) NULL" },
  { table: "rwl_assessment_submissions", column: "expected_delivery_on", definition: "DATE NULL" },
  { table: "rwl_assessment_submissions", column: "delivered_at", definition: "DATETIME(3) NULL" },
  // Assigned mentor shown on the student dashboard.
  { table: "rwl_assessment_submissions", column: "mentor_name", definition: "VARCHAR(120) NOT NULL DEFAULT ''" },
  { table: "rwl_assessment_submissions", column: "mentor_phone", definition: "VARCHAR(32) NOT NULL DEFAULT ''" },
  // Practical challenge the student turns in, and the mentor's reply.
  { table: "rwl_assessment_submissions", column: "challenge_notes", definition: "TEXT NULL" },
  { table: "rwl_assessment_submissions", column: "challenge_submitted_at", definition: "DATETIME(3) NULL" },
  { table: "rwl_assessment_submissions", column: "mentor_feedback", definition: "TEXT NULL" },
  { table: "rwl_assessment_submissions", column: "mentor_feedback_at", definition: "DATETIME(3) NULL" },
];

const addedIndexes: { table: string; index: string; definition: string }[] = [
  {
    table: "rwl_assessment_submissions",
    index: "idx_rwl_assessment_tracking",
    definition: "UNIQUE INDEX idx_rwl_assessment_tracking (tracking_code)",
  },
  {
    table: "rwl_assessment_submissions",
    index: "idx_rwl_assessment_box_status",
    definition: "INDEX idx_rwl_assessment_box_status (box_status)",
  },
];

async function applyPendingMigrations(db: Pool) {
  for (const { table, column, definition } of addedColumns) {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1",
      [table, column],
    );
    if (rows.length === 0) {
      await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      logger.info({ table, column }, "Added missing column");
    }
  }
  for (const { table, index, definition } of addedIndexes) {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1",
      [table, index],
    );
    if (rows.length === 0) {
      await db.query(`ALTER TABLE \`${table}\` ADD ${definition}`);
      logger.info({ table, index }, "Added missing index");
    }
  }
}

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
  await applyPendingMigrations(db);
  await db.query("DELETE FROM rwl_admin_otp_challenges WHERE expires_at < UTC_TIMESTAMP(3)");
  await db.query("DELETE FROM rwl_admin_sessions WHERE expires_at < UTC_TIMESTAMP(3)");
  logger.info("MySQL schema is ready");
}
