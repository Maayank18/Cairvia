import { SCHEMA_VERSIONS, type ContextPacketV1, type WorkThreadV1 } from "@cairvia/schemas";
import type { ThreadStore } from "./ports.js";

/** Bounded packet for UI and agent reasoning. Never the whole store. */
export async function buildContextPacket(
  store: ThreadStore,
  thread: WorkThreadV1 | null
): Promise<ContextPacketV1> {
  const events = await store.listEvents(8);
  return {
    schemaVersion: SCHEMA_VERSIONS.contextPacket,
    threadId: thread?.id ?? null,
    intent: thread?.intent ?? "No Work Thread",
    currentState: thread?.currentState ?? "Nothing stored",
    nextAction: thread?.nextAction ?? "Start or capture a Work Thread.",
    blockers: thread?.blockers ?? [],
    recentEventTypes: events.map((item) => item.type),
    recoveryNextAction: thread?.recoveryCapsule?.nextAction ?? null,
    evidenceRefs: (thread?.evidenceRefs ?? []).slice(0, 6),
    generatedAt: new Date().toISOString()
  };
}
