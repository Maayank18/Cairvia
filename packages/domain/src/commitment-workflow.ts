import type { CommitmentCandidateV1, WorkThreadV1 } from "@cairvia/schemas";
import { SCHEMA_VERSIONS } from "@cairvia/schemas";
import { interpretCommitment } from "./context-interpreter.js";

export interface CommitmentStore {
  getByIdempotency(key: string): Promise<CommitmentCandidateV1 | null>;
  saveCommitment(item: CommitmentCandidateV1): Promise<void>;
}

export async function runCommitmentCapture(input: {
  selectedText: string;
  pageTitle?: string | null;
  pageUrl?: string | null;
  threadId?: string | null;
  store: CommitmentStore;
  threshold?: number;
}): Promise<{ candidate: CommitmentCandidateV1; duplicate: boolean }> {
  const draft = interpretCommitment(input);
  const existing = await input.store.getByIdempotency(draft.idempotencyKey);
  if (existing && existing.status !== "REJECTED" && existing.status !== "FAILED") {
    return { candidate: existing, duplicate: true };
  }
  if (draft.status !== "FAILED") {
    draft.status = "WAITING_FOR_USER";
  }
  await input.store.saveCommitment(draft);
  return { candidate: draft, duplicate: false };
}

export function applyCommitmentDecision(
  candidate: CommitmentCandidateV1,
  decision: "add" | "reject",
  editedAction?: string,
  editedDeadline?: string | null
): CommitmentCandidateV1 {
  const ts = new Date().toISOString();
  if (decision === "reject") {
    return {
      ...candidate,
      status: "REJECTED",
      updatedAt: ts
    };
  }
  return {
    ...candidate,
    proposedAction: editedAction?.trim() || candidate.proposedAction,
    deadline: editedDeadline === undefined ? candidate.deadline : editedDeadline,
    status: "SUCCEEDED",
    needsClarification: false,
    clarificationPrompt: null,
    confidence: Math.max(candidate.confidence, 0.9),
    updatedAt: ts
  };
}

export function threadPatchFromCommitment(candidate: CommitmentCandidateV1): {
  schemaVersion: typeof SCHEMA_VERSIONS.threadUpdate;
  nextAction: string;
  evidenceRefs?: string[];
} {
  const deadline = candidate.deadline ? ` by ${candidate.deadline}` : "";
  return {
    schemaVersion: SCHEMA_VERSIONS.threadUpdate,
    nextAction: `${candidate.proposedAction}${deadline}`,
    evidenceRefs: [
      `commitment:${candidate.id}`,
      candidate.pageUrl ? `url:${candidate.pageUrl}` : "source:browser.selection"
    ].filter(Boolean)
  };
}

export function mergeEvidence(
  thread: WorkThreadV1,
  extra: string[]
): string[] {
  return [...new Set([...thread.evidenceRefs, ...extra])];
}
