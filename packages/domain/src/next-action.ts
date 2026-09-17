import {
  ProposedActionV1Schema,
  SCHEMA_VERSIONS,
  type ProposedActionV1,
  type WorkThreadV1
} from "@cairvia/schemas";

export function planNextAction(thread: WorkThreadV1 | null): ProposedActionV1 {
  if (!thread) {
    return ProposedActionV1Schema.parse({
      schemaVersion: SCHEMA_VERSIONS.proposedAction,
      nextAction: "Start or capture a Work Thread.",
      whyNow: "No thread is available.",
      confidence: 0,
      evidenceRefs: [],
      invented: false
    });
  }
  if (thread.nextAction.trim().length > 0) {
    return ProposedActionV1Schema.parse({
      schemaVersion: SCHEMA_VERSIONS.proposedAction,
      nextAction: thread.nextAction,
      whyNow: thread.blockers[0]
        ? `This is stored on the Work Thread. Blocker: ${thread.blockers[0]}.`
        : "Using the stored next action.",
      estimatedMinutes: thread.estimatedEffort
        ? Number.parseInt(thread.estimatedEffort, 10) || undefined
        : undefined,
      confidence: thread.confidence,
      evidenceRefs: thread.evidenceRefs.slice(0, 4),
      invented: false
    });
  }
  return ProposedActionV1Schema.parse({
    schemaVersion: SCHEMA_VERSIONS.proposedAction,
    nextAction: "No next action is stored. Add one to continue.",
    whyNow: "Nothing was invented; the thread has no next action.",
    confidence: 0.2,
    evidenceRefs: thread.evidenceRefs.slice(0, 4),
    invented: false
  });
}
