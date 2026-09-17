import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workThreads = sqliteTable("work_threads", {
  id: text("id").primaryKey(),
  schemaVersion: text("schema_version").notNull(),
  payloadJson: text("payload_json").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const recoveryCapsules = sqliteTable("recovery_capsules", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  schemaVersion: text("schema_version").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull()
});

export const actions = sqliteTable("actions", {
  id: text("id").primaryKey(),
  threadId: text("thread_id"),
  toolId: text("tool_id").notNull(),
  status: text("status").notNull(),
  risk: text("risk").notNull(),
  inputJson: text("input_json").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  resultJson: text("result_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const actionPermissions = sqliteTable("action_permissions", {
  actionId: text("action_id").primaryKey(),
  payloadJson: text("payload_json").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const automationDefinitions = sqliteTable("automation_definitions", {
  id: text("id").primaryKey(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const executionEvents = sqliteTable("execution_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull()
});

export const userPreferences = sqliteTable("user_preferences", {
  id: text("id").primaryKey(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const syncQueue = sqliteTable("sync_queue", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payloadJson: text("payload_json").notNull(),
  status: text("status").notNull(),
  attempts: integer("attempts").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const schemaMigrations = sqliteTable("schema_migrations", {
  version: text("version").primaryKey(),
  appliedAt: text("applied_at").notNull()
});

export const contextSnapshots = sqliteTable("context_snapshots", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull()
});

export const contextItems = sqliteTable("context_items", {
  id: text("id").primaryKey(),
  threadId: text("thread_id"),
  type: text("type").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull()
});

export const commitments = sqliteTable("commitments", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull(),
  payloadJson: text("payload_json").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});
