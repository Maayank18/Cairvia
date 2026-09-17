import { describe, expect, it } from "vitest";
import { IllegalThreadTransitionError, transition } from "./thread-machine.js";

describe("Work Thread state machine", () => {
  it("allows ACTIVE → INTERRUPTED → RECOVERABLE → ACTIVE", () => {
    const interrupted = transition("ACTIVE", "INTERRUPTED");
    const recoverable = transition(interrupted, "RECOVERABLE");
    expect(transition(recoverable, "ACTIVE")).toBe("ACTIVE");
  });

  it("forbids COMPLETED → ACTIVE", () => {
    expect(() => transition("COMPLETED", "ACTIVE")).toThrow(
      IllegalThreadTransitionError
    );
  });
});
