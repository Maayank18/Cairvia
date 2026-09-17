import { describe, expect, it } from "vitest";
import { assertExecutable, defaultPermissions, evaluatePermission } from "./permissions.js";

describe("action permission evaluation", () => {
  const permissions = defaultPermissions("2026-09-17T10:00:00.000Z");

  it("allows LOW tools by default", () => {
    expect(evaluatePermission(permissions, "open_url")).toBe("allow");
    expect(evaluatePermission(permissions, "copy_to_clipboard")).toBe("allow");
  });

  it("asks for MEDIUM and never for HIGH", () => {
    expect(evaluatePermission(permissions, "run_predefined_command")).toBe("ask");
    expect(evaluatePermission(permissions, "delete_data")).toBe("never");
  });

  it("blocks Phase 1 execution of HIGH tools", () => {
    expect(() => assertExecutable("delete_data")).toThrow(/Phase 1/);
  });
});
