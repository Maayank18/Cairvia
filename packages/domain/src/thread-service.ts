import { randomUUID } from "node:crypto";
import {
  SCHEMA_VERSIONS,
  ThreadUpdateV1Schema,
  WorkThreadV1Schema,
  type ProgressNoteV1,
  type ThreadUpdateV1,
  type UserPreferencesV1,
  type WorkThreadV1,
  defaultUserPreferences
} from "@cairvia/schemas";
import type { ThreadStore } from "./ports.js";
import { createRecoveryCapsule } from "./recovery.js";
import { isCapsuleStale } from "./stale.js";
import { transition } from "./thread-machine.js";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export class ThreadNotFoundError extends Error {
  constructor(id: string) {
    super(`Work Thread not found: ${id}`);
    this.name = "ThreadNotFoundError";
  }
}

export class ThreadService {
  constructor(private readonly store: ThreadStore) {}

  async createThread(
    input: Omit<
      WorkThreadV1,
      | "schemaVersion"
      | "id"
      | "createdAt"
      | "updatedAt"
      | "lastValidatedAt"
      | "recoveryCapsule"
      | "userPreferencesSnapshot"
    > & { userPreferencesSnapshot?: UserPreferencesV1 }
  ): Promise<WorkThreadV1> {
    const ts = nowIso();
    const thread = WorkThreadV1Schema.parse({
      ...input,
      schemaVersion: SCHEMA_VERSIONS.workThread,
      id: newId("thr"),
      createdAt: ts,
      updatedAt: ts,
      lastValidatedAt: ts,
      recoveryCapsule: null,
      userPreferencesSnapshot:
        input.userPreferencesSnapshot ?? defaultUserPreferences()
    });
    await this.store.insertThread(thread);
    await this.audit("thread.created", thread.id, { status: thread.status });
    return thread;
  }

  async getThread(id: string): Promise<WorkThreadV1> {
    const thread = await this.store.getThread(id);
    if (!thread) {
      throw new ThreadNotFoundError(id);
    }
    return this.withCapsule(thread);
  }

  async getActiveThread(): Promise<WorkThreadV1 | null> {
    const thread = await this.store.getActiveThread();
    if (!thread) {
      return null;
    }
    return this.withCapsule(thread);
  }

  async listThreads(): Promise<WorkThreadV1[]> {
    const threads = await this.store.listThreads();
    return Promise.all(threads.map((t) => this.withCapsule(t)));
  }

  async updateThread(id: string, patch: ThreadUpdateV1): Promise<WorkThreadV1> {
    const parsed = ThreadUpdateV1Schema.parse(patch);
    const current = await this.getThread(id);
    const ts = nowIso();
    const next = WorkThreadV1Schema.parse({
      ...current,
      ...parsed,
      schemaVersion: SCHEMA_VERSIONS.workThread,
      id: current.id,
      status: current.status,
      updatedAt: ts,
      lastValidatedAt: ts
    });
    await this.store.updateThread(next);
    await this.audit("thread.updated", id, {});
    return this.withCapsule(next);
  }

  async pauseThread(id: string): Promise<WorkThreadV1> {
    return this.setStatus(id, "PAUSED", "thread.paused");
  }

  async resumeThread(id: string): Promise<WorkThreadV1> {
    const current = await this.getThread(id);
    const ts = nowIso();
    const next = WorkThreadV1Schema.parse({
      ...current,
      status: transition(current.status, "ACTIVE"),
      updatedAt: ts,
      lastValidatedAt: ts,
      lastActiveAt: ts,
      interruptionReason: undefined
    });
    await this.store.updateThread(next);
    await this.audit("thread.resumed", id, {});
    return this.withCapsule(next);
  }

  async completeThread(id: string): Promise<WorkThreadV1> {
    return this.setStatus(id, "COMPLETED", "thread.completed");
  }

  async markProgress(id: string, note: ProgressNoteV1): Promise<WorkThreadV1> {
    const current = await this.getThread(id);
    const ts = nowIso();
    const evidence = [...current.evidenceRefs, `progress:${note.note}`];
    const next = WorkThreadV1Schema.parse({
      ...current,
      currentState: note.done
        ? `${current.currentState}; ${note.note}`
        : current.currentState,
      evidenceRefs: evidence,
      updatedAt: ts,
      lastValidatedAt: ts,
      lastActiveAt: ts
    });
    await this.store.updateThread(next);
    await this.audit("thread.progress", id, { note: note.note, done: note.done });
    return this.withCapsule(next);
  }

  async captureRecovery(id: string): Promise<WorkThreadV1> {
    const current = await this.getThread(id);
    const ts = nowIso();
    const capsule = createRecoveryCapsule(current, ts);
    await this.store.insertCapsule(capsule);
    let status = current.status;
    if (current.status === "ACTIVE") {
      status = transition(transition("ACTIVE", "INTERRUPTED"), "RECOVERABLE");
    } else if (current.status === "INTERRUPTED") {
      status = transition("INTERRUPTED", "RECOVERABLE");
    }
    const next = WorkThreadV1Schema.parse({
      ...current,
      status,
      recoveryCapsule: capsule,
      updatedAt: ts,
      interruptionReason: current.interruptionReason ?? "user_capture"
    });
    await this.store.updateThread(next);
    await this.audit("recovery.captured", id, { capsuleId: capsule.id });
    return this.withCapsule(next);
  }

  async getRecovery(id: string) {
    const capsule = await this.store.getLatestCapsule(id);
    if (!capsule) {
      return { capsule: null, stale: false };
    }
    return { capsule, stale: isCapsuleStale(capsule) };
  }

  private async setStatus(
    id: string,
    to: WorkThreadV1["status"],
    event: string
  ): Promise<WorkThreadV1> {
    const current = await this.getThread(id);
    const ts = nowIso();
    const next = WorkThreadV1Schema.parse({
      ...current,
      status: transition(current.status, to),
      updatedAt: ts,
      lastValidatedAt: ts
    });
    await this.store.updateThread(next);
    await this.audit(event, id, { from: current.status, to });
    return this.withCapsule(next);
  }

  private async withCapsule(thread: WorkThreadV1): Promise<WorkThreadV1> {
    const capsule = await this.store.getLatestCapsule(thread.id);
    return { ...thread, recoveryCapsule: capsule };
  }

  private async audit(
    type: string,
    threadId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const ts = nowIso();
    await this.store.appendEvent({
      schemaVersion: SCHEMA_VERSIONS.executionEvent,
      id: newId("evt"),
      type,
      threadId,
      payload,
      createdAt: ts
    });
    await this.store.enqueueSync({
      schemaVersion: SCHEMA_VERSIONS.syncQueueItem,
      id: newId("sync"),
      type,
      payload: { threadId, ...payload },
      status: "PENDING",
      attempts: 0,
      createdAt: ts,
      updatedAt: ts
    });
  }
}
