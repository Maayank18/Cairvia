import { describe, expect, it } from "vitest";
import { containsSecret, redactSecrets } from "./memory-policy.js";

describe("memory policy", () => {
  it("redacts secrets and never stores them as facts", () => {
    expect(containsSecret("api_key=sk-secret")).toBe(true);
    expect(redactSecrets("password=hunter2").text).toContain("[redacted]");
    expect(containsSecret("Please send the report by Thursday.")).toBe(false);
  });
});
