import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const usePostgres = !!process.env.DATABASE_URL;

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    avatar_color TEXT NOT NULL DEFAULT '#6366f1',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(team_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#a5b4fc',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date TEXT,
    position REAL NOT NULL DEFAULT 0,
    assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS task_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_board ON tasks(board_id);
  CREATE INDEX IF NOT EXISTS idx_boards_team ON boards(team_id);
`;

const PG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    avatar_color TEXT NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(team_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS boards (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS columns (
    id SERIAL PRIMARY KEY,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#a5b4fc',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date TEXT,
    position DOUBLE PRECISION NOT NULL DEFAULT 0,
    assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_board ON tasks(board_id);
  CREATE INDEX IF NOT EXISTS idx_boards_team ON boards(team_id);
`;

function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

let pool = null;
let sqliteDb = null;
const stmtCache = new Map();

if (usePostgres) {
  const sslDisabled = /(^|[?&])sslmode=disable(&|$)/.test(process.env.DATABASE_URL);
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
    max: 10,
  });
  pool.on("error", (err) => {
    console.error("Error en el pool de Postgres:", err.message);
  });
} else {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "data", "taskflow.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec("PRAGMA journal_mode = WAL");
  sqliteDb.exec("PRAGMA foreign_keys = ON");
}

if (usePostgres) {
  await pool.query(PG_SCHEMA);
} else {
  sqliteDb.exec(SQLITE_SCHEMA);
}

function sqliteRun(sql, params) {
  const stmt = stmtCache.get(sql) || sqliteDb.prepare(sql);
  stmtCache.set(sql, stmt);
  const res = stmt.run(...params);
  return { lastInsertRowid: Number(res.lastInsertRowid) };
}

function sqliteGet(sql, params) {
  const stmt = stmtCache.get(sql) || sqliteDb.prepare(sql);
  stmtCache.set(sql, stmt);
  return stmt.get(...params) ?? null;
}

function sqliteAll(sql, params) {
  const stmt = stmtCache.get(sql) || sqliteDb.prepare(sql);
  stmtCache.set(sql, stmt);
  return stmt.all(...params);
}

export async function get(sql, params = []) {
  if (usePostgres) {
    const r = await pool.query(convertPlaceholders(sql), params);
    return r.rows[0] ?? null;
  }
  return sqliteGet(sql, params);
}

export async function all(sql, params = []) {
  if (usePostgres) {
    const r = await pool.query(convertPlaceholders(sql), params);
    return r.rows;
  }
  return sqliteAll(sql, params);
}

export async function run(sql, params = []) {
  if (usePostgres) {
    const r = await pool.query(convertPlaceholders(sql), params);
    return { lastInsertRowid: r.rows[0] ? Number(r.rows[0].id) : null };
  }
  return sqliteRun(sql, params);
}

export async function transaction(fn) {
  if (usePostgres) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const q = {
        get: async (sql, p = []) => (await client.query(convertPlaceholders(sql), p)).rows[0] ?? null,
        all: async (sql, p = []) => (await client.query(convertPlaceholders(sql), p)).rows,
        run: async (sql, p = []) => {
          const r = await client.query(convertPlaceholders(sql), p);
          return { lastInsertRowid: r.rows[0] ? Number(r.rows[0].id) : null };
        },
      };
      const result = await fn(q);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
  sqliteDb.exec("BEGIN");
  try {
    const q = {
      get: (sql, p = []) => sqliteGet(sql, p),
      all: (sql, p = []) => sqliteAll(sql, p),
      run: (sql, p = []) => sqliteRun(sql, p),
    };
    const result = await fn(q);
    sqliteDb.exec("COMMIT");
    return result;
  } catch (err) {
    sqliteDb.exec("ROLLBACK");
    throw err;
  }
}

export function generateInviteCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}
