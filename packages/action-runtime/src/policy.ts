import {
  PHASE1_EXECUTABLE,
  evaluatePermission,
  TOOL_RISK
} from "@cairvia/domain";
import type { ActionPermissionV1, ToolId } from "@cairvia/schemas";

export class ActionDeniedError extends Error {
  constructor(toolId: ToolId, effect: string) {
    super(`Action ${toolId} is not permitted (${effect})`);
    this.name = "ActionDeniedError";
  }
}

export function authorize(
  permissions: ActionPermissionV1[],
  toolId: ToolId
): void {
  if (!PHASE1_EXECUTABLE.has(toolId)) {
    throw new ActionDeniedError(toolId, "phase1_not_executable");
  }
  const effect = evaluatePermission(permissions, toolId);
  if (effect === "never") {
    throw new ActionDeniedError(toolId, effect);
  }
  if (effect === "ask") {
    throw new ActionDeniedError(toolId, "awaiting_approval");
  }
  if (TOOL_RISK[toolId] !== "LOW") {
    throw new ActionDeniedError(toolId, "phase1_low_only");
  }
}
