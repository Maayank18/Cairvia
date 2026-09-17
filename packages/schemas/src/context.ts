import { z } from "zod";
import { SCHEMA_VERSIONS } from "./versions.js";

export const ContextTypeSchema = z.enum([
  "USER_FACT",
  "TASK_STATE",
  "PROJECT_CONTEXT",
  "DECISION",
  "BLOCKER",
  "LAST_ACTION",
  "NEXT_ACTION",
  "COMMITMENT_CANDIDATE",
  "PREFERENCE"
]);
export type ContextType = z.infer<typeof ContextTypeSchema>;

export const ContextLifecycleSchema = z.enum([
  "ACTIVE",
  "CONFIRMED",
  "CANDIDATE",
  "STALE",
  "REJECTED"
]);
export type ContextLifecycle = z.infer<typeof ContextLifecycleSchema>;

export const EvidenceLabelSchema = z.enum([
  "Confirmed",
  "Inferred",
  "Candidate",
  "Stale"
]);
export type EvidenceLabel = z.infer<typeof EvidenceLabelSchema>;

export const ContextItemV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.contextItem),
  id: z.string().min(1),
  threadId: z.string().nullable(),
  type: ContextTypeSchema,
  value: z.string().min(1),
  source: z.string().min(1),
  timestamp: z.string().datetime(),
  confidence: z.number().min(0).max(1),
  lifecycle: ContextLifecycleSchema,
  userConfirmed: z.boolean(),
  createdAt: z.string().datetime(),
  lastConfirmedAt: z.string().datetime().nullable()
});
export type ContextItemV1 = z.infer<typeof ContextItemV1Schema>;

export const ContextSnapshotV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.contextSnapshot),
  id: z.string().min(1),
  threadId: z.string().min(1),
  capturedAt: z.string().datetime(),
  goal: z.string(),
  currentTask: z.string(),
  blocker: z.string().nullable(),
  lastAction: z.string().nullable(),
  nextAction: z.string(),
  sourceEvents: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  reason: z.string()
});
export type ContextSnapshotV1 = z.infer<typeof ContextSnapshotV1Schema>;

export const ResumeCardV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.resumeCard),
  threadId: z.string().nullable(),
  whatIWasDoing: z.string(),
  whereIStopped: z.string(),
  blocker: z.string().nullable(),
  nextAction: z.string(),
  confidence: z.number().min(0).max(1),
  evidenceLabel: EvidenceLabelSchema,
  lowConfidence: z.boolean(),
  lowConfidenceReason: z.string().nullable(),
  stale: z.boolean(),
  alsoInterrupted: z.array(
    z.object({
      threadId: z.string(),
      intent: z.string()
    })
  ),
  capturedAt: z.string().datetime().nullable()
});
export type ResumeCardV1 = z.infer<typeof ResumeCardV1Schema>;

export const CommitmentCandidateV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.commitmentCandidate),
  id: z.string().min(1),
  idempotencyKey: z.string().min(1),
  threadId: z.string().nullable(),
  selectedText: z.string().min(1),
  pageTitle: z.string().nullable(),
  pageUrl: z.string().nullable(),
  proposedAction: z.string(),
  deadline: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
  clarificationPrompt: z.string().nullable(),
  status: z.enum([
    "PENDING",
    "RUNNING",
    "WAITING_FOR_USER",
    "SUCCEEDED",
    "FAILED",
    "TIMED_OUT",
    "REJECTED"
  ]),
  source: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type CommitmentCandidateV1 = z.infer<typeof CommitmentCandidateV1Schema>;

export const ProposedActionV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.proposedAction),
  nextAction: z.string().min(1),
  whyNow: z.string().min(1),
  estimatedMinutes: z.number().positive().optional(),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string()),
  invented: z.literal(false)
});
export type ProposedActionV1 = z.infer<typeof ProposedActionV1Schema>;
