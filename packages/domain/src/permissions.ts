import type {
  ActionPermissionV1,
  ActionRisk,
  PermissionEffect,
  ToolId
} from "@cairvia/schemas";
import { SCHEMA_VERSIONS } from "@cairvia/schemas";

export const TOOL_RISK: Record<ToolId, ActionRisk> = {
  open_url: "LOW",
  open_file: "LOW",
  open_app: "LOW",
  copy_to_clipboard: "LOW",
  start_focus: "LOW",
  run_predefined_command: "MEDIUM",
  send_external_message: "HIGH",
  delete_data: "HIGH"
};

export const PHASE1_EXECUTABLE: ReadonlySet<ToolId> = new Set([
  "open_url",
  "open_file",
  "open_app",
  "copy_to_clipboard",
  "start_focus"
]);

export function defaultPermissions(nowIso: string): ActionPermissionV1[] {
  return (Object.keys(TOOL_RISK) as ToolId[]).map((actionId) => ({
    schemaVersion: SCHEMA_VERSIONS.actionPermission,
    actionId,
    risk: TOOL_RISK[actionId],
    effect:
      TOOL_RISK[actionId] === "LOW"
        ? "allow"
        : TOOL_RISK[actionId] === "MEDIUM"
          ? "ask"
          : "never",
    updatedAt: nowIso
  }));
}

export function evaluatePermission(
  permissions: ActionPermissionV1[],
  toolId: ToolId
): PermissionEffect {
  const match = permissions.find((p) => p.actionId === toolId);
  if (!match) {
    return "never";
  }
  return match.effect;
}

export function assertExecutable(toolId: ToolId): void {
  if (!PHASE1_EXECUTABLE.has(toolId)) {
    throw new Error(
      `Tool ${toolId} is not executable in Phase 1 (MEDIUM/HIGH execution is disabled)`
    );
  }
}
