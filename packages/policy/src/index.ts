export type PolicyAction =
  | "READ_CONTEXT"
  | "CREATE_TASK"
  | "WRITE_LOCAL"
  | "SEND_EXTERNAL_MESSAGE"
  | "DELETE_DATA";

export type PolicyDecision = "permit" | "forbid";

/**
 * Cedar-shaped MVP evaluator. Same permit/forbid semantics as
 * packages/policy/cedar/cairvia.cedar. Default deny.
 */
export function evaluateCedar(input: {
  action: PolicyAction;
  userApproved?: boolean;
}): { decision: PolicyDecision; reasons: string[] } {
  if (input.action === "READ_CONTEXT") {
    return { decision: "permit", reasons: ["cedar:permit READ_CONTEXT"] };
  }
  if (input.action === "CREATE_TASK" || input.action === "WRITE_LOCAL") {
    if (input.userApproved) {
      return {
        decision: "permit",
        reasons: [`cedar:permit ${input.action} when userApproved`]
      };
    }
    return {
      decision: "forbid",
      reasons: [`cedar:require approval for ${input.action}`]
    };
  }
  return {
    decision: "forbid",
    reasons: [`cedar:forbid ${input.action}`]
  };
}
