import { randomUUID } from "node:crypto";
import {
  SCHEMA_VERSIONS,
  type RecoveryCapsuleV1,
  type WorkThreadV1
} from "@cairvia/schemas";

export const DEFAULT_STALE_AFTER_MINUTES = 120;

export function createRecoveryCapsule(
  thread: WorkThreadV1,
  capturedAt: string = new Date().toISOString(),
  staleAfterMinutes: number = DEFAULT_STALE_AFTER_MINUTES
): RecoveryCapsuleV1 {
  return {
    schemaVersion: SCHEMA_VERSIONS.recoveryCapsule,
    id: `cap_${randomUUID()}`,
    threadId: thread.id,
    intent: thread.intent,
    currentState: thread.currentState,
    nextAction: thread.nextAction,
    blockers: [...thread.blockers],
    lastKnownDecision: thread.decisions.at(-1) ?? null,
    evidenceRefs: [...thread.evidenceRefs],
    capturedAt,
    confidence: thread.confidence,
    staleAfterMinutes
  };
}
