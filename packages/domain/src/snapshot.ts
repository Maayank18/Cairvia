import { randomUUID } from "node:crypto";
import {
  SCHEMA_VERSIONS,
  type ContextSnapshotV1,
  type WorkThreadV1
} from "@cairvia/schemas";

export function createSnapshot(
  thread: WorkThreadV1,
  reason: string,
  sourceEvents: string[],
  capturedAt: string = new Date().toISOString()
): ContextSnapshotV1 {
  return {
    schemaVersion: SCHEMA_VERSIONS.contextSnapshot,
    id: `snap_${randomUUID()}`,
    threadId: thread.id,
    capturedAt,
    goal: thread.desiredOutcome,
    currentTask: thread.currentState,
    blocker: thread.blockers[0] ?? null,
    lastAction: thread.evidenceRefs.at(-1) ?? null,
    nextAction: thread.nextAction,
    sourceEvents,
    confidence: thread.confidence,
    reason
  };
}
