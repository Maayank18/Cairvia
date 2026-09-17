import { z } from "zod";
import { SCHEMA_VERSIONS } from "./versions.js";

export const ThreadStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "BLOCKED",
  "INTERRUPTED",
  "RECOVERABLE",
  "COMPLETED",
  "ARCHIVED"
]);
export type ThreadStatus = z.infer<typeof ThreadStatusSchema>;

export const UserPreferencesV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.userPreferences),
  communication: z.object({
    conciseResponses: z.boolean(),
    concreteWording: z.boolean(),
    explainAmbiguousInstructions: z.boolean()
  }),
  execution: z.object({
    oneActionAtATime: z.boolean(),
    showEffortEstimate: z.boolean(),
    breakDownLargeTasks: z.boolean(),
    minimizeInterruptions: z.boolean()
  }),
  recovery: z.object({
    keepResumeState: z.boolean(),
    surfaceLastKnownBlocker: z.boolean(),
    remindWhatAlreadyTried: z.boolean()
  }),
  control: z.object({
    askBeforeConsequentialActions: z.boolean()
  }),
  reducedMotion: z.boolean(),
  interactionMode: z.enum(["CALM", "GUIDED", "DETAILED"]).default("GUIDED")
});
export type UserPreferencesV1 = z.infer<typeof UserPreferencesV1Schema>;

export const defaultUserPreferences = (): UserPreferencesV1 => ({
  schemaVersion: SCHEMA_VERSIONS.userPreferences,
  communication: {
    conciseResponses: true,
    concreteWording: true,
    explainAmbiguousInstructions: true
  },
  execution: {
    oneActionAtATime: true,
    showEffortEstimate: true,
    breakDownLargeTasks: true,
    minimizeInterruptions: true
  },
  recovery: {
    keepResumeState: true,
    surfaceLastKnownBlocker: true,
    remindWhatAlreadyTried: true
  },
  control: {
    askBeforeConsequentialActions: true
  },
  reducedMotion: false,
  interactionMode: "GUIDED"
});

export const RecoveryCapsuleV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.recoveryCapsule),
  id: z.string().min(1),
  threadId: z.string().min(1),
  intent: z.string().min(1),
  currentState: z.string().min(1),
  nextAction: z.string().min(1),
  blockers: z.array(z.string()),
  lastKnownDecision: z.string().nullable(),
  evidenceRefs: z.array(z.string()),
  capturedAt: z.string().datetime(),
  confidence: z.number().min(0).max(1),
  staleAfterMinutes: z.number().int().positive()
});
export type RecoveryCapsuleV1 = z.infer<typeof RecoveryCapsuleV1Schema>;

export const NextActionRequestV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.actionRequest),
  toolId: z.enum([
    "open_url",
    "open_file",
    "open_app",
    "copy_to_clipboard",
    "start_focus"
  ]),
  input: z.record(z.unknown())
});
export type NextActionRequestV1 = z.infer<typeof NextActionRequestV1Schema>;

export const WorkThreadV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.workThread),
  id: z.string().min(1),
  project: z.string().optional(),
  intent: z.string().min(1),
  desiredOutcome: z.string().min(1),
  currentState: z.string().min(1),
  nextAction: z.string().min(1),
  blockers: z.array(z.string()),
  decisions: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
  lastValidatedAt: z.string().datetime(),
  status: ThreadStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  confidence: z.number().min(0).max(1),
  recoveryCapsule: RecoveryCapsuleV1Schema.nullable(),
  userPreferencesSnapshot: UserPreferencesV1Schema,
  estimatedEffort: z.string().optional(),
  lastActiveAt: z.string().datetime().optional(),
  interruptionReason: z.string().optional(),
  nextActionRequest: NextActionRequestV1Schema.nullable(),
  version: z.number().int().positive().default(1)
});
export type WorkThreadV1 = z.infer<typeof WorkThreadV1Schema>;

export const ThreadUpdateV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.threadUpdate),
  intent: z.string().min(1).optional(),
  desiredOutcome: z.string().min(1).optional(),
  currentState: z.string().min(1).optional(),
  nextAction: z.string().min(1).optional(),
  blockers: z.array(z.string()).optional(),
  decisions: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  estimatedEffort: z.string().optional(),
  nextActionRequest: NextActionRequestV1Schema.nullable().optional(),
  expectedVersion: z.number().int().positive().optional()
});
export type ThreadUpdateV1 = z.infer<typeof ThreadUpdateV1Schema>;

export const ProgressNoteV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.progressNote),
  note: z.string().min(1),
  done: z.boolean().default(false)
});
export type ProgressNoteV1 = z.infer<typeof ProgressNoteV1Schema>;
