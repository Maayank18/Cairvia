import { randomUUID } from "node:crypto";
import {
  SCHEMA_VERSIONS,
  type ContextItemV1,
  type ContextSnapshotV1,
  type ResumeCardV1,
  type WorkThreadV1
} from "@cairvia/schemas";
import { buildResumeCard, withTimeout } from "./recovery-engine.js";
import { createSnapshot } from "./snapshot.js";
import { planNextAction } from "./next-action.js";
import type { ThreadStore } from "./ports.js";

export class ContinuityService {
  constructor(private readonly store: ThreadStore) {}

  async snapshotThread(
    thread: WorkThreadV1,
    reason: string,
    sourceEvents: string[]
  ): Promise<ContextSnapshotV1> {
    const snapshot = createSnapshot(thread, reason, sourceEvents);
    await this.store.insertSnapshot(snapshot);
    await this.store.appendEvent({
      schemaVersion: SCHEMA_VERSIONS.executionEvent,
      id: `evt_${randomUUID()}`,
      type: "snapshot.captured",
      threadId: thread.id,
      actor: "system",
      action: "snapshot.captured",
      resource: snapshot.id,
      correlationId: snapshot.id,
      payload: { reason },
      createdAt: snapshot.capturedAt
    });
    return snapshot;
  }

  async recordContext(item: Omit<ContextItemV1, "schemaVersion" | "id" | "createdAt"> & { id?: string }): Promise<ContextItemV1> {
    const ts = new Date().toISOString();
    const stored: ContextItemV1 = {
      schemaVersion: SCHEMA_VERSIONS.contextItem,
      id: item.id ?? `ctx_${randomUUID()}`,
      createdAt: ts,
      ...item,
      timestamp: item.timestamp ?? ts
    };
    await this.store.insertContextItem(stored);
    return stored;
  }

  async resumeCard(timeoutMs = 2500): Promise<ResumeCardV1> {
    const fallback = buildResumeCard({ threads: [], snapshots: [] });
    return withTimeout(
      this.buildCard(),
      timeoutMs,
      {
        ...fallback,
        lowConfidence: true,
        lowConfidenceReason: "Recovery timed out; showing nothing invented."
      }
    );
  }

  private async buildCard(): Promise<ResumeCardV1> {
    const threads = await this.store.listThreads();
    const snapshots = await this.store.listSnapshots();
    const withCapsules = await Promise.all(
      threads.map(async (thread) => ({
        ...thread,
        recoveryCapsule: await this.store.getLatestCapsule(thread.id)
      }))
    );
    const card = buildResumeCard({ threads: withCapsules, snapshots });
    const planned = planNextAction(
      withCapsules.find((t) => t.id === card.threadId) ?? null
    );
    if (!planned.invented && planned.nextAction) {
      return { ...card, nextAction: planned.nextAction };
    }
    return card;
  }
}
