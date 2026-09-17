import { describe, expect, it } from "vitest";
import { defaultPermissions } from "./permissions.js";
import { ActionBrokerError, evaluateProposedAction } from "./action-broker.js";

const permissions = defaultPermissions("2026-09-17T10:00:00.000Z");

describe("action broker", () => {
  it("allows READ/LOCAL_PREPARE without extra confirmation", () => {
    const gate = evaluateProposedAction(
      { toolId: "start_focus", confirmed: false },
      permissions
    );
    expect(gate.authorizationResult).toBe("allow");
    expect(gate.riskClass).toBe("LOCAL_PREPARE");
  });

  it("requires confirmation for WRITE_LOCAL", () => {
    expect(() =>
      evaluateProposedAction(
        { toolId: "run_predefined_command", confirmed: false },
        permissions
      )
    ).toThrow(/needs confirmation/);
  });

  it("denies DESTRUCTIVE actions", () => {
    expect(() =>
      evaluateProposedAction({ toolId: "delete_data", confirmed: true }, permissions)
    ).toThrow(/Destructive/);
  });
});
