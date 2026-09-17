import type { Database } from "sql.js";

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_threads (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recovery_capsules (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  thread_id TEXT,
  tool_id TEXT NOT NULL,
  status TEXT NOT NULL,
  risk TEXT NOT NULL,
  input_json TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS action_permissions (
  action_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_definitions (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_threads_updated ON work_threads(updated_at);
CREATE INDEX IF NOT EXISTS idx_capsules_thread ON recovery_capsules(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_created ON execution_events(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status);
`;

const CONTINUITY_SQL = `
CREATE TABLE IF NOT EXISTS context_snapshots (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_items (
  id TEXT PRIMARY KEY,
  thread_id TEXT,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commitments (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_thread ON context_snapshots(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_commitments_idemp ON commitments(idempotency_key);
`;

const MIGRATIONS = [
  { version: "0001_init", sql: INIT_SQL },
  { version: "0002_continuity", sql: CONTINUITY_SQL }
];

export const MIGRATION_VERSION = "0002_continuity";

export function applyMigrations(sqlite: Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  for (const migration of MIGRATIONS) {
    const result = sqlite.exec(
      `SELECT version FROM schema_migrations WHERE version = '${migration.version}'`
    );
    const found = result[0]?.values?.[0]?.[0];
    if (found) {
      continue;
    }
    sqlite.exec(migration.sql);
    sqlite.run(
      "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      [migration.version, new Date().toISOString()]
    );
  }
}
