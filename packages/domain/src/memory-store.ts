import { randomUUID } from "node:crypto";
import {
  SCHEMA_VERSIONS,
  defaultUserPreferences,
  type ActionPermissionV1,
  type CommitmentCandidateV1,
  type ContextItemV1,
  type ContextSnapshotV1,
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
  snapshots: ContextSnapshotV1[] = [];
  contextItems: ContextItemV1[] = [];
  commitments: CommitmentCandidateV1[] = [];

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
    const matches = this.capsules.filter((c) => c.threadId === threadId);
    return matches[matches.length - 1] ?? null;
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
  async insertSnapshot(snapshot: ContextSnapshotV1): Promise<void> {
    this.snapshots.push(snapshot);
  }
  async listSnapshots(threadId?: string): Promise<ContextSnapshotV1[]> {
    return this.snapshots.filter((s) => !threadId || s.threadId === threadId);
  }
  async insertContextItem(item: ContextItemV1): Promise<void> {
    this.contextItems.push(item);
  }
  async listContextItems(threadId?: string): Promise<ContextItemV1[]> {
    return this.contextItems.filter((i) => !threadId || i.threadId === threadId);
  }
  async saveCommitment(item: CommitmentCandidateV1): Promise<void> {
    const index = this.commitments.findIndex((c) => c.id === item.id);
    if (index >= 0) {
      this.commitments[index] = item;
    } else {
      this.commitments.push(item);
    }
  }
  async getCommitment(id: string): Promise<CommitmentCandidateV1 | null> {
    return this.commitments.find((c) => c.id === id) ?? null;
  }
  async getCommitmentByIdempotency(
    key: string
  ): Promise<CommitmentCandidateV1 | null> {
    return this.commitments.find((c) => c.idempotencyKey === key) ?? null;
  }
  async listCommitments(): Promise<CommitmentCandidateV1[]> {
    return [...this.commitments].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
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
