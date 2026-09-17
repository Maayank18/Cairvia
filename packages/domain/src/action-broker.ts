import type {
  ActionPermissionV1,
  ActionRequestV1,
  ExecutionRiskClass,
  ToolId
} from "@cairvia/schemas";
import { evaluatePermission, PHASE1_EXECUTABLE } from "./permissions.js";

export const TOOL_EXECUTION_CLASS: Record<ToolId, ExecutionRiskClass> = {
  open_url: "READ",
  open_file: "READ",
  open_app: "READ",
  copy_to_clipboard: "LOCAL_PREPARE",
  start_focus: "LOCAL_PREPARE",
  run_predefined_command: "WRITE_LOCAL",
  send_external_message: "EXTERNAL_WRITE",
  delete_data: "DESTRUCTIVE"
};

export class ActionBrokerError extends Error {
  constructor(
    message: string,
    public readonly authorizationResult: "allow" | "ask" | "deny",
    public readonly riskClass: ExecutionRiskClass
  ) {
    super(message);
    this.name = "ActionBrokerError";
  }
}

export function evaluateProposedAction(
  request: Pick<ActionRequestV1, "toolId" | "confirmed">,
  permissions: ActionPermissionV1[]
): {
  riskClass: ExecutionRiskClass;
  authorizationResult: "allow" | "ask" | "deny";
} {
  const riskClass = TOOL_EXECUTION_CLASS[request.toolId];
  if (riskClass === "DESTRUCTIVE") {
    throw new ActionBrokerError(
      "Destructive actions are denied in the MVP.",
      "deny",
      riskClass
    );
  }
  const effect = evaluatePermission(permissions, request.toolId);
  if (effect === "never") {
    throw new ActionBrokerError(
      `Action ${request.toolId} is never permitted.`,
      "deny",
      riskClass
    );
  }
  const needsConfirm =
    riskClass === "WRITE_LOCAL" ||
    riskClass === "EXTERNAL_WRITE" ||
    effect === "ask";
  if (needsConfirm && !request.confirmed) {
    throw new ActionBrokerError(
      `Action ${request.toolId} needs confirmation (${riskClass}).`,
      "ask",
      riskClass
    );
  }
  if (!PHASE1_EXECUTABLE.has(request.toolId)) {
    throw new ActionBrokerError(
      `Tool ${request.toolId} is not executable yet.`,
      "deny",
      riskClass
    );
  }
  return { riskClass, authorizationResult: "allow" };
}
