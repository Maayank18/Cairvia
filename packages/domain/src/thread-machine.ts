import type { ThreadStatus } from "@cairvia/schemas";

const ALLOWED: Record<ThreadStatus, ThreadStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["PAUSED", "BLOCKED", "INTERRUPTED", "COMPLETED"],
  PAUSED: ["ACTIVE", "ARCHIVED", "INTERRUPTED"],
  BLOCKED: ["ACTIVE", "PAUSED", "INTERRUPTED"],
  INTERRUPTED: ["RECOVERABLE", "ACTIVE", "PAUSED"],
  RECOVERABLE: ["ACTIVE", "PAUSED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: []
};

export class IllegalThreadTransitionError extends Error {
  constructor(
    public readonly from: ThreadStatus,
    public readonly to: ThreadStatus
  ) {
    super(`Cannot transition Work Thread from ${from} to ${to}`);
    this.name = "IllegalThreadTransitionError";
  }
}

export function canTransition(from: ThreadStatus, to: ThreadStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function transition(
  from: ThreadStatus,
  to: ThreadStatus
): ThreadStatus {
  if (!canTransition(from, to)) {
    throw new IllegalThreadTransitionError(from, to);
  }
  return to;
}
