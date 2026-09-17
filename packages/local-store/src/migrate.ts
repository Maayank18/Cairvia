import type { Database } from "sql.js";

export const MIGRATION_VERSION = "0001_init";

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

export function applyMigrations(sqlite: Database): void {
  sqlite.exec(INIT_SQL);
  const result = sqlite.exec(
    `SELECT version FROM schema_migrations WHERE version = '${MIGRATION_VERSION}'`
  );
  const found = result[0]?.values?.[0]?.[0];
  if (found) {
    return;
  }
  sqlite.run(
    "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
    [MIGRATION_VERSION, new Date().toISOString()]
  );
}
