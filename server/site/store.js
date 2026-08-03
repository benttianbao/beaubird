const { randomBytes, scryptSync, timingSafeEqual } = require("node:crypto");
const { mkdirSync } = require("node:fs");
const { dirname } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const PASSWORD_KEY_LENGTH = 64;
const TEMPORARY_PASSWORD = "123456";

function nowIso() {
  return new Date().toISOString();
}

function initializeSiteDatabase(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
      disabled INTEGER NOT NULL DEFAULT 0,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_ip_attempts (
      ip TEXT PRIMARY KEY,
      failed_count INTEGER NOT NULL DEFAULT 0,
      window_started_at INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      action TEXT NOT NULL,
      target_user_id INTEGER,
      ip TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS csrf_tokens (
      token TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function normalizeUsername(username) {
  return String(username || "").trim();
}

function assertUsername(username) {
  const normalized = normalizeUsername(username);
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(normalized)) {
    throw new Error("用户名需为 3-32 位字母、数字、点、下划线或短横线。");
  }
  return normalized;
}

function assertPassword(password) {
  const value = String(password || "");
  if (value.length < 10 || value.length > 128 || !/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    throw new Error("密码需为 10-128 位，并且同时包含英文字母和数字。");
  }
  return value;
}

function hashPassword(password, salt = randomBytes(16).toString("hex"), options = {}) {
  const checked = options.allowTemporaryPassword ? String(password || "") : assertPassword(password);
  const hash = scryptSync(checked, salt, PASSWORD_KEY_LENGTH).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, user) {
  if (!user?.password_hash || !user?.password_salt) {
    return false;
  }
  const candidate = scryptSync(String(password || ""), user.password_salt, PASSWORD_KEY_LENGTH);
  const expected = Buffer.from(user.password_hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function generateTemporaryPassword() {
  return TEMPORARY_PASSWORD;
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    disabled: Boolean(user.disabled),
    mustChangePassword: Boolean(user.must_change_password),
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

function getUserByUsername(db, username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(normalizeUsername(username));
}

function getUserById(db, id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function listUsers(db) {
  return db.prepare("SELECT * FROM users ORDER BY id ASC").all().map(toPublicUser);
}

function createUser(db, options) {
  const username = assertUsername(options.username);
  const password = options.password || generateTemporaryPassword();
  const role = options.role === "admin" ? "admin" : "user";
  const mustChangePassword = options.mustChangePassword === false ? 0 : 1;
  const { hash, salt } = hashPassword(password, undefined, {
    allowTemporaryPassword: password === TEMPORARY_PASSWORD && mustChangePassword === 1
  });
  const timestamp = nowIso();
  const result = db
    .prepare(
      `INSERT INTO users
        (username, password_hash, password_salt, role, disabled, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
    )
    .run(username, hash, salt, role, mustChangePassword, timestamp, timestamp);
  return {
    user: toPublicUser(getUserById(db, Number(result.lastInsertRowid))),
    temporaryPassword: password
  };
}

function setUserDisabled(db, id, disabled) {
  db.prepare("UPDATE users SET disabled = ?, updated_at = ? WHERE id = ?").run(disabled ? 1 : 0, nowIso(), id);
  return toPublicUser(getUserById(db, id));
}

function resetUserPassword(db, id) {
  const password = generateTemporaryPassword();
  const { hash, salt } = hashPassword(password, undefined, { allowTemporaryPassword: true });
  db.prepare(
    "UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 1, updated_at = ? WHERE id = ?"
  ).run(hash, salt, nowIso(), id);
  return {
    user: toPublicUser(getUserById(db, id)),
    temporaryPassword: password
  };
}

function changeUserPassword(db, userId, newPassword) {
  const { hash, salt } = hashPassword(newPassword);
  db.prepare(
    "UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = ? WHERE id = ?"
  ).run(hash, salt, nowIso(), userId);
  return toPublicUser(getUserById(db, userId));
}

function createSession(db, userId, ttlMs = 1000 * 60 * 60 * 12) {
  const id = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions (id, user_id, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    userId,
    csrfToken,
    Date.now() + ttlMs,
    nowIso()
  );
  db.prepare("INSERT INTO csrf_tokens (token, session_id, created_at) VALUES (?, ?, ?)").run(csrfToken, id, nowIso());
  return { id, csrfToken };
}

function deleteSession(db, sessionId) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

function getSessionUser(db, sessionId) {
  if (!sessionId) {
    return null;
  }
  const row = db
    .prepare(
      `SELECT sessions.id AS session_id, sessions.csrf_token, sessions.expires_at,
              users.*
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ?`
    )
    .get(sessionId);
  if (!row || row.expires_at <= Date.now() || row.disabled) {
    if (row) {
      deleteSession(db, sessionId);
    }
    return null;
  }
  return {
    sessionId: row.session_id,
    csrfToken: row.csrf_token,
    user: row
  };
}

function getLoginIpAttempt(db, ip) {
  return db.prepare("SELECT * FROM login_ip_attempts WHERE ip = ?").get(String(ip || ""));
}

function isLoginIpLocked(db, ip) {
  const attempt = getLoginIpAttempt(db, ip);
  return Boolean(attempt && attempt.locked_until > Date.now());
}

function recordLoginIpFailure(db, ip, security) {
  const now = Date.now();
  const windowMs = Math.max(1, Number(security.loginFailureWindowMs) || Number(security.lockoutMs) || 1);
  const attempt = getLoginIpAttempt(db, ip);
  const expired =
    !attempt ||
    (attempt.locked_until > 0 && attempt.locked_until <= now) ||
    attempt.window_started_at + windowMs <= now;
  const windowStartedAt = expired ? now : attempt.window_started_at;
  const failedCount = (expired ? 0 : attempt.failed_count) + 1;
  const lockedUntil = failedCount >= security.maxLoginFailures ? now + security.lockoutMs : 0;

  db.prepare(
    `INSERT INTO login_ip_attempts (ip, failed_count, window_started_at, locked_until, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(ip) DO UPDATE SET
       failed_count = excluded.failed_count,
       window_started_at = excluded.window_started_at,
       locked_until = excluded.locked_until,
       updated_at = excluded.updated_at`
  ).run(String(ip || ""), failedCount, windowStartedAt, lockedUntil, nowIso());
}

function clearLoginIpFailures(db, ip) {
  db.prepare("DELETE FROM login_ip_attempts WHERE ip = ?").run(String(ip || ""));
}

function writeAuditLog(db, entry) {
  db.prepare(
    "INSERT INTO audit_logs (actor_user_id, action, target_user_id, ip, details, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    entry.actorUserId || null,
    entry.action,
    entry.targetUserId || null,
    entry.ip || "",
    JSON.stringify(entry.details || {}),
    nowIso()
  );
}

module.exports = {
  assertPassword,
  assertUsername,
  changeUserPassword,
  clearLoginIpFailures,
  createSession,
  createUser,
  deleteSession,
  generateTemporaryPassword,
  getSessionUser,
  getUserById,
  getUserByUsername,
  initializeSiteDatabase,
  isLoginIpLocked,
  listUsers,
  recordLoginIpFailure,
  resetUserPassword,
  setUserDisabled,
  toPublicUser,
  TEMPORARY_PASSWORD,
  verifyPassword,
  writeAuditLog
};
