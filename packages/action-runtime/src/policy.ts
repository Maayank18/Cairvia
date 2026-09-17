import {
  ActionBrokerError,
  evaluateProposedAction
} from "@cairvia/domain";
import type { ActionPermissionV1, ActionRequestV1 } from "@cairvia/schemas";

export class ActionDeniedError extends Error {
  constructor(
    message: string,
    public readonly authorizationResult: "allow" | "ask" | "deny" = "deny"
  ) {
    super(message);
    this.name = "ActionDeniedError";
  }
}

export function authorize(
  permissions: ActionPermissionV1[],
  request: Pick<ActionRequestV1, "toolId" | "confirmed">
): ReturnType<typeof evaluateProposedAction> {
  try {
    return evaluateProposedAction(request, permissions);
  } catch (error) {
    if (error instanceof ActionBrokerError) {
      throw new ActionDeniedError(error.message, error.authorizationResult);
    }
    throw error;
  }
}
