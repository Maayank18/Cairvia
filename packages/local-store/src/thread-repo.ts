import { desc, eq } from "drizzle-orm";
import {
  ActionPermissionV1Schema,
  ExecutionEventV1Schema,
  RecoveryCapsuleV1Schema,
  SCHEMA_VERSIONS,
  SyncQueueItemV1Schema,
  UserPreferencesV1Schema,
  WorkThreadV1Schema,
  defaultUserPreferences,
  type ActionPermissionV1,
  type ExecutionEventV1,
  type RecoveryCapsuleV1,
  type SyncQueueItemV1,
  type UserPreferencesV1,
  type WorkThreadV1
} from "@cairvia/schemas";
import { defaultPermissions } from "@cairvia/domain";
import type { ThreadStore } from "@cairvia/domain";
import type { CairviaDb } from "./client.js";
import {
  actionPermissions,
  executionEvents,
  recoveryCapsules,
  syncQueue,
  userPreferences,
  workThreads
} from "./schema.js";

const PREFS_ID = "default";

export class SqliteThreadStore implements ThreadStore {
  constructor(
    private readonly db: CairviaDb,
    private readonly persist: () => void = () => undefined
  ) {}

  async insertThread(thread: WorkThreadV1): Promise<void> {
    const parsed = WorkThreadV1Schema.parse(thread);
    this.db.insert(workThreads).values({
      id: parsed.id,
      schemaVersion: parsed.schemaVersion,
      payloadJson: JSON.stringify(parsed),
      status: parsed.status,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt
    }).run();
    this.persist();
  }

  async getThread(id: string): Promise<WorkThreadV1 | null> {
    const row = this.db.select().from(workThreads).where(eq(workThreads.id, id)).get();
    return row ? WorkThreadV1Schema.parse(JSON.parse(row.payloadJson)) : null;
  }

  async getActiveThread(): Promise<WorkThreadV1 | null> {
    const rows = this.db
      .select()
      .from(workThreads)
      .orderBy(desc(workThreads.updatedAt))
      .all();
    const parsed = rows.map((r) => WorkThreadV1Schema.parse(JSON.parse(r.payloadJson)));
    return (
      parsed.find((t) =>
        ["ACTIVE", "PAUSED", "BLOCKED", "INTERRUPTED", "RECOVERABLE"].includes(
          t.status
        )
      ) ??
      parsed[0] ??
      null
    );
  }

  async listThreads(): Promise<WorkThreadV1[]> {
    const rows = this.db
      .select()
      .from(workThreads)
      .orderBy(desc(workThreads.updatedAt))
      .all();
    return rows.map((r) => WorkThreadV1Schema.parse(JSON.parse(r.payloadJson)));
  }

  async updateThread(thread: WorkThreadV1): Promise<void> {
    const parsed = WorkThreadV1Schema.parse(thread);
    this.db
      .update(workThreads)
      .set({
        payloadJson: JSON.stringify(parsed),
        status: parsed.status,
        updatedAt: parsed.updatedAt,
        schemaVersion: parsed.schemaVersion
      })
      .where(eq(workThreads.id, parsed.id))
      .run();
    this.persist();
  }

  async insertCapsule(capsule: RecoveryCapsuleV1): Promise<void> {
    const parsed = RecoveryCapsuleV1Schema.parse(capsule);
    this.db.insert(recoveryCapsules).values({
      id: parsed.id,
      threadId: parsed.threadId,
      schemaVersion: parsed.schemaVersion,
      payloadJson: JSON.stringify(parsed),
      createdAt: parsed.capturedAt
    }).run();
    this.persist();
  }

  async getLatestCapsule(threadId: string): Promise<RecoveryCapsuleV1 | null> {
    const row = this.db
      .select()
      .from(recoveryCapsules)
      .where(eq(recoveryCapsules.threadId, threadId))
      .orderBy(desc(recoveryCapsules.createdAt))
      .get();
    return row
      ? RecoveryCapsuleV1Schema.parse(JSON.parse(row.payloadJson))
      : null;
  }

  async appendEvent(event: ExecutionEventV1): Promise<void> {
    const parsed = ExecutionEventV1Schema.parse(event);
    this.db.insert(executionEvents).values({
      id: parsed.id,
      type: parsed.type,
      payloadJson: JSON.stringify(parsed),
      createdAt: parsed.createdAt
    }).run();
    this.persist();
  }

  async listEvents(limit = 100): Promise<ExecutionEventV1[]> {
    const rows = this.db
      .select()
      .from(executionEvents)
      .orderBy(desc(executionEvents.createdAt))
      .all()
      .slice(0, limit);
    return rows.map((r) =>
      ExecutionEventV1Schema.parse(JSON.parse(r.payloadJson))
    );
  }

  async enqueueSync(item: SyncQueueItemV1): Promise<void> {
    const parsed = SyncQueueItemV1Schema.parse(item);
    this.db.insert(syncQueue).values({
      id: parsed.id,
      type: parsed.type,
      payloadJson: JSON.stringify(parsed.payload),
      status: parsed.status,
      attempts: parsed.attempts,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt
    }).run();
    this.persist();
  }

  async listPendingSync(): Promise<SyncQueueItemV1[]> {
    const rows = this.db
      .select()
      .from(syncQueue)
      .where(eq(syncQueue.status, "PENDING"))
      .all();
    return rows.map((r) =>
      SyncQueueItemV1Schema.parse({
        schemaVersion: SCHEMA_VERSIONS.syncQueueItem,
        id: r.id,
        type: r.type,
        payload: JSON.parse(r.payloadJson),
        status: r.status,
        attempts: r.attempts,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      })
    );
  }

  async markSync(id: string, status: SyncQueueItemV1["status"]): Promise<void> {
    this.db
      .update(syncQueue)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(syncQueue.id, id))
      .run();
    this.persist();
  }

  async getPreferences(): Promise<UserPreferencesV1> {
    const row = this.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.id, PREFS_ID))
      .get();
    if (!row) {
      return defaultUserPreferences();
    }
    return UserPreferencesV1Schema.parse(JSON.parse(row.payloadJson));
  }

  async savePreferences(prefs: UserPreferencesV1): Promise<void> {
    const parsed = UserPreferencesV1Schema.parse(prefs);
    const ts = new Date().toISOString();
    const existing = this.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.id, PREFS_ID))
      .get();
    if (existing) {
      this.db
        .update(userPreferences)
        .set({ payloadJson: JSON.stringify(parsed), updatedAt: ts })
        .where(eq(userPreferences.id, PREFS_ID))
        .run();
      this.persist();
      return;
    }
    this.db.insert(userPreferences).values({
      id: PREFS_ID,
      payloadJson: JSON.stringify(parsed),
      createdAt: ts,
      updatedAt: ts
    }).run();
    this.persist();
  }

  async listPermissions(): Promise<ActionPermissionV1[]> {
    const rows = this.db.select().from(actionPermissions).all();
    if (rows.length === 0) {
      const seeded = defaultPermissions(new Date().toISOString());
      await this.savePermissions(seeded);
      return seeded;
    }
    return rows.map((r) =>
      ActionPermissionV1Schema.parse(JSON.parse(r.payloadJson))
    );
  }

  async savePermissions(permissions: ActionPermissionV1[]): Promise<void> {
    for (const permission of permissions) {
      const parsed = ActionPermissionV1Schema.parse(permission);
      const existing = this.db
        .select()
        .from(actionPermissions)
        .where(eq(actionPermissions.actionId, parsed.actionId))
        .get();
      if (existing) {
        this.db
          .update(actionPermissions)
          .set({
            payloadJson: JSON.stringify(parsed),
            updatedAt: parsed.updatedAt
          })
          .where(eq(actionPermissions.actionId, parsed.actionId))
          .run();
      } else {
        this.db.insert(actionPermissions).values({
          actionId: parsed.actionId,
          payloadJson: JSON.stringify(parsed),
          updatedAt: parsed.updatedAt
        }).run();
      }
    }
    this.persist();
  }
}
