import { isCapsuleStale } from "./stale.js";
import type {
  ContextSnapshotV1,
  RecoveryCapsuleV1,
  ResumeCardV1,
  WorkThreadV1
} from "@cairvia/schemas";
import { SCHEMA_VERSIONS } from "@cairvia/schemas";

export interface RecoveryInput {
  threads: WorkThreadV1[];
  snapshots: ContextSnapshotV1[];
  now?: Date;
}

const EMPTY: ResumeCardV1 = {
  schemaVersion: SCHEMA_VERSIONS.resumeCard,
  threadId: null,
  whatIWasDoing: "No saved context yet.",
  whereIStopped: "Nothing is stored to resume from.",
  blocker: null,
  nextAction: "Start or capture a Work Thread.",
  confidence: 0,
  evidenceLabel: "Candidate",
  lowConfidence: true,
  lowConfidenceReason: "No snapshot or thread is available.",
  stale: false,
  alsoInterrupted: [],
  capturedAt: null
};

function interrupted(thread: WorkThreadV1): boolean {
  return ["PAUSED", "INTERRUPTED", "RECOVERABLE", "BLOCKED"].includes(
    thread.status
  );
}

function evidenceLabel(
  thread: WorkThreadV1 | null,
  capsule: RecoveryCapsuleV1 | null,
  stale: boolean
): ResumeCardV1["evidenceLabel"] {
  if (stale) {
    return "Stale";
  }
  if (capsule || (thread && thread.confidence >= 0.8)) {
    return thread?.status === "ACTIVE" ? "Confirmed" : "Inferred";
  }
  return "Candidate";
}

export function buildResumeCard(input: RecoveryInput): ResumeCardV1 {
  const now = input.now ?? new Date();
  const ranked = [...input.threads].sort((a, b) =>
    (b.lastActiveAt ?? b.updatedAt).localeCompare(a.lastActiveAt ?? a.updatedAt)
  );
  const primary =
    ranked.find((t) => interrupted(t)) ??
    ranked.find((t) => t.status === "ACTIVE") ??
    ranked[0] ??
    null;
  if (!primary) {
    return EMPTY;
  }

  const snapshot = input.snapshots
    .filter((s) => s.threadId === primary.id)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
  const capsule = primary.recoveryCapsule;
  const stale = capsule ? isCapsuleStale(capsule, now) : false;
  const rawNext =
    snapshot?.nextAction || capsule?.nextAction || primary.nextAction;
  const nextAction =
    rawNext.trim().length > 0
      ? rawNext.trim()
      : "No next action is stored. Add one to continue.";
  const elapsedMs = Date.parse(primary.lastActiveAt ?? primary.updatedAt);
  const minutesAway = Number.isNaN(elapsedMs)
    ? 0
    : Math.max(0, Math.round((now.getTime() - elapsedMs) / 60000));
  let confidence = snapshot?.confidence ?? capsule?.confidence ?? primary.confidence;
  if (stale) {
    confidence = Math.min(confidence, 0.4);
  }
  const lowConfidence = confidence < 0.6;
  const alsoInterrupted = ranked
    .filter((t) => t.id !== primary.id && interrupted(t))
    .map((t) => ({ threadId: t.id, intent: t.intent }));

  return {
    schemaVersion: SCHEMA_VERSIONS.resumeCard,
    threadId: primary.id,
    whatIWasDoing: `${primary.project ? `${primary.project} — ` : ""}${primary.intent}`,
    whereIStopped: snapshot?.currentTask ?? primary.currentState,
    blocker: snapshot?.blocker ?? primary.blockers[0] ?? null,
    nextAction,
    confidence,
    evidenceLabel: evidenceLabel(primary, capsule, stale),
    lowConfidence,
    lowConfidenceReason: lowConfidence
      ? stale
        ? "This recovery state may be outdated."
        : "Evidence is incomplete; the next step is only a stored suggestion."
      : minutesAway > 120
        ? `Last validated about ${minutesAway} minutes ago.`
        : null,
    stale,
    alsoInterrupted,
    capturedAt: snapshot?.capturedAt ?? capsule?.capturedAt ?? primary.updatedAt
  };
}

export async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
