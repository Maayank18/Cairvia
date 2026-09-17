import { randomUUID } from "node:crypto";
import {
  SCHEMA_VERSIONS,
  defaultUserPreferences,
  type ActionPermissionV1,
  type ExecutionEventV1,
  type RecoveryCapsuleV1,
  type SyncQueueItemV1,
  type UserPreferencesV1,
  type WorkThreadV1
} from "@cairvia/schemas";
import { defaultPermissions } from "./permissions.js";
import type { ThreadStore } from "./ports.js";

export class MemoryThreadStore implements ThreadStore {
  threads = new Map<string, WorkThreadV1>();
  capsules: RecoveryCapsuleV1[] = [];
  events: ExecutionEventV1[] = [];
  sync: SyncQueueItemV1[] = [];
  preferences: UserPreferencesV1 = defaultUserPreferences();
  permissions: ActionPermissionV1[] = defaultPermissions(new Date().toISOString());

  async insertThread(thread: WorkThreadV1): Promise<void> {
    this.threads.set(thread.id, thread);
  }
  async getThread(id: string): Promise<WorkThreadV1 | null> {
    return this.threads.get(id) ?? null;
  }
  async getActiveThread(): Promise<WorkThreadV1 | null> {
    const list = [...this.threads.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
    return (
      list.find((t) =>
        ["ACTIVE", "PAUSED", "BLOCKED", "INTERRUPTED", "RECOVERABLE"].includes(
          t.status
        )
      ) ??
      list[0] ??
      null
    );
  }
  async listThreads(): Promise<WorkThreadV1[]> {
    return [...this.threads.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }
  async updateThread(thread: WorkThreadV1): Promise<void> {
    this.threads.set(thread.id, thread);
  }
  async insertCapsule(capsule: RecoveryCapsuleV1): Promise<void> {
    this.capsules.push(capsule);
  }
  async getLatestCapsule(threadId: string): Promise<RecoveryCapsuleV1 | null> {
    return (
      this.capsules
        .filter((c) => c.threadId === threadId)
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0] ?? null
    );
  }
  async appendEvent(event: ExecutionEventV1): Promise<void> {
    this.events.push(event);
  }
  async listEvents(limit = 100): Promise<ExecutionEventV1[]> {
    return this.events.slice(-limit);
  }
  async enqueueSync(item: SyncQueueItemV1): Promise<void> {
    this.sync.push(item);
  }
  async listPendingSync(): Promise<SyncQueueItemV1[]> {
    return this.sync.filter((s) => s.status === "PENDING");
  }
  async markSync(id: string, status: SyncQueueItemV1["status"]): Promise<void> {
    const item = this.sync.find((s) => s.id === id);
    if (item) {
      item.status = status;
      item.updatedAt = new Date().toISOString();
    }
  }
  async getPreferences(): Promise<UserPreferencesV1> {
    return this.preferences;
  }
  async savePreferences(prefs: UserPreferencesV1): Promise<void> {
    this.preferences = prefs;
  }
  async listPermissions(): Promise<ActionPermissionV1[]> {
    return this.permissions;
  }
  async savePermissions(permissions: ActionPermissionV1[]): Promise<void> {
    this.permissions = permissions;
  }
}

export function newEvent(
  type: string,
  payload: Record<string, unknown>
): ExecutionEventV1 {
  return {
    schemaVersion: SCHEMA_VERSIONS.executionEvent,
    id: `evt_${randomUUID()}`,
    type,
    payload,
    createdAt: new Date().toISOString()
  };
}
