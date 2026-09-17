import { z } from "zod";
import { SCHEMA_VERSIONS } from "./versions.js";

export const ActionRiskSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type ActionRisk = z.infer<typeof ActionRiskSchema>;

export const PermissionEffectSchema = z.enum(["allow", "ask", "never"]);
export type PermissionEffect = z.infer<typeof PermissionEffectSchema>;

export const ToolIdSchema = z.enum([
  "open_url",
  "open_file",
  "open_app",
  "copy_to_clipboard",
  "start_focus",
  "run_predefined_command",
  "send_external_message",
  "delete_data"
]);
export type ToolId = z.infer<typeof ToolIdSchema>;

export const ActionStatusSchema = z.enum([
  "PROPOSED",
  "AWAITING_APPROVAL",
  "AUTHORIZED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED"
]);
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

export const ExecutionRiskClassSchema = z.enum([
  "READ",
  "LOCAL_PREPARE",
  "WRITE_LOCAL",
  "EXTERNAL_WRITE",
  "DESTRUCTIVE"
]);
export type ExecutionRiskClass = z.infer<typeof ExecutionRiskClassSchema>;

export const ActionRequestV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.actionRequest),
  id: z.string().min(1),
  toolId: ToolIdSchema,
  threadId: z.string().min(1).optional(),
  input: z.record(z.unknown()),
  idempotencyKey: z.string().min(1),
  confirmed: z.boolean().optional()
});
export type ActionRequestV1 = z.infer<typeof ActionRequestV1Schema>;

export const ActionResultV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.actionResult),
  actionId: z.string().min(1),
  status: ActionStatusSchema,
  message: z.string(),
  verified: z.boolean(),
  at: z.string().datetime(),
  riskClass: ExecutionRiskClassSchema.optional(),
  authorizationResult: z.enum(["allow", "ask", "deny"]).optional()
});
export type ActionResultV1 = z.infer<typeof ActionResultV1Schema>;

export const ActionPermissionV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.actionPermission),
  actionId: ToolIdSchema,
  effect: PermissionEffectSchema,
  risk: ActionRiskSchema,
  updatedAt: z.string().datetime()
});
export type ActionPermissionV1 = z.infer<typeof ActionPermissionV1Schema>;
