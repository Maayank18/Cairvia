import { z } from "zod";
import { SCHEMA_VERSIONS } from "./versions.js";

export const SyncSourceSchema = z.enum([
  "ORB",
  "EXTENSION",
  "WEB",
  "BACKEND",
  "AUTOMATION",
  "AGENT"
]);
export type SyncSource = z.infer<typeof SyncSourceSchema>;

export const SyncEventTypeSchema = z.enum([
  "THREAD_CREATED",
  "THREAD_UPDATED",
  "THREAD_INTERRUPTED",
  "RECOVERY_CAPTURED",
  "THREAD_RECOVERED",
  "ACTION_STARTED",
  "ACTION_SUCCEEDED",
  "ACTION_FAILED",
  "COMMITMENT_CONFIRMED",
  "AUTOMATION_UPDATED",
  "HELLO"
]);
export type SyncEventType = z.infer<typeof SyncEventTypeSchema>;

export const SyncEventV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.syncEvent),
  eventId: z.string().min(1),
  type: SyncEventTypeSchema,
  userId: z.string().min(1),
  threadId: z.string().optional(),
  source: SyncSourceSchema,
  version: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown())
});
export type SyncEventV1 = z.infer<typeof SyncEventV1Schema>;

export const ContextPacketV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.contextPacket),
  threadId: z.string().nullable(),
  intent: z.string(),
  currentState: z.string(),
  nextAction: z.string(),
  blockers: z.array(z.string()),
  recentEventTypes: z.array(z.string()),
  recoveryNextAction: z.string().nullable(),
  evidenceRefs: z.array(z.string()),
  generatedAt: z.string().datetime()
});
export type ContextPacketV1 = z.infer<typeof ContextPacketV1Schema>;
