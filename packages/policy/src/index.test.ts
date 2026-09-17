import { describe, expect, it } from "vitest";
import { evaluateCedar } from "./index.js";

describe("Cedar MVP policy", () => {
  it("allows reading context", () => {
    expect(evaluateCedar({ action: "READ_CONTEXT" }).decision).toBe("permit");
  });

  it("requires approval to create a task", () => {
    expect(evaluateCedar({ action: "CREATE_TASK" }).decision).toBe("forbid");
    expect(
      evaluateCedar({ action: "CREATE_TASK", userApproved: true }).decision
    ).toBe("permit");
  });

  it("denies delete and external send", () => {
    expect(evaluateCedar({ action: "DELETE_DATA" }).decision).toBe("forbid");
    expect(
      evaluateCedar({ action: "SEND_EXTERNAL_MESSAGE", userApproved: true })
        .decision
    ).toBe("forbid");
  });
});
