import { createHash, randomUUID } from "node:crypto";
import { SCHEMA_VERSIONS, type CommitmentCandidateV1 } from "@cairvia/schemas";
import { containsSecret, redactSecrets } from "./memory-policy.js";

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

export const DEFAULT_COMMITMENT_THRESHOLD = 0.7;

export function idempotencyKeyFor(
  selectedText: string,
  pageUrl: string | null
): string {
  return createHash("sha256")
    .update(`${pageUrl ?? ""}::${selectedText.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

export function interpretCommitment(input: {
  selectedText: string;
  pageTitle?: string | null;
  pageUrl?: string | null;
  threadId?: string | null;
  threshold?: number;
  now?: Date;
}): CommitmentCandidateV1 {
  const ts = (input.now ?? new Date()).toISOString();
  const threshold = input.threshold ?? DEFAULT_COMMITMENT_THRESHOLD;
  if (containsSecret(input.selectedText)) {
    return {
      schemaVersion: SCHEMA_VERSIONS.commitmentCandidate,
      id: `cmt_${randomUUID()}`,
      idempotencyKey: idempotencyKeyFor(input.selectedText, input.pageUrl ?? null),
      threadId: input.threadId ?? null,
      selectedText: "[redacted]",
      pageTitle: input.pageTitle ?? null,
      pageUrl: input.pageUrl ?? null,
      proposedAction: "",
      deadline: null,
      confidence: 0,
      needsClarification: true,
      clarificationPrompt: "That selection looks like a secret. It was not stored.",
      status: "FAILED",
      source: "browser.selection",
      createdAt: ts,
      updatedAt: ts
    };
  }
  const { text } = redactSecrets(input.selectedText);
  const lower = text.toLowerCase();
  const deadlineMatch = lower.match(
    new RegExp(`\\bby\\s+(${WEEKDAYS.join("|")}|\\d{4}-\\d{2}-\\d{2})\\b`, "i")
  );
  const deadline = deadlineMatch?.[1]
    ? deadlineMatch[1][0]!.toUpperCase() + deadlineMatch[1].slice(1)
    : null;
  const actionMatch = text.match(
    /(?:please\s+)?((?:send|review|fix|update|finish|write|deploy|inspect)\b[^.]{3,80})/i
  );
  const proposedAction = actionMatch?.[1]?.trim() ?? "";
  let confidence = 0.35;
  if (proposedAction) {
    confidence = 0.62;
  }
  if (proposedAction && deadline) {
    confidence = 0.86;
  }
  const needsClarification = confidence < threshold || !proposedAction;
  return {
    schemaVersion: SCHEMA_VERSIONS.commitmentCandidate,
    id: `cmt_${randomUUID()}`,
    idempotencyKey: idempotencyKeyFor(text, input.pageUrl ?? null),
    threadId: input.threadId ?? null,
    selectedText: text.slice(0, 500),
    pageTitle: input.pageTitle ?? null,
    pageUrl: input.pageUrl ?? null,
    proposedAction: proposedAction || "Clarify what should be done",
    deadline,
    confidence,
    needsClarification,
    clarificationPrompt: needsClarification
      ? proposedAction
        ? "What deadline should this work toward?"
        : "What should the next action be?"
      : null,
    status: needsClarification ? "WAITING_FOR_USER" : "WAITING_FOR_USER",
    source: "browser.selection",
    createdAt: ts,
    updatedAt: ts
  };
}
