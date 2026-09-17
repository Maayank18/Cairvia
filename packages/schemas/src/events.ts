import { z } from "zod";
import { SCHEMA_VERSIONS } from "./versions.js";

export const ExecutionEventV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.executionEvent),
  id: z.string().min(1),
  type: z.string().min(1),
  threadId: z.string().optional(),
  actionId: z.string().optional(),
  actor: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  authorizationResult: z.string().optional(),
  correlationId: z.string().optional(),
  payload: z.record(z.unknown()),
  createdAt: z.string().datetime()
});
export type ExecutionEventV1 = z.infer<typeof ExecutionEventV1Schema>;

export const SyncQueueItemV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.syncQueueItem),
  id: z.string().min(1),
  type: z.string().min(1),
  payload: z.record(z.unknown()),
  status: z.enum(["PENDING", "SYNCED", "FAILED"]),
  attempts: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type SyncQueueItemV1 = z.infer<typeof SyncQueueItemV1Schema>;
