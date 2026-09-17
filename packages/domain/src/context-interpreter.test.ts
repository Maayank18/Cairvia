import { describe, expect, it } from "vitest";
import { interpretCommitment, idempotencyKeyFor } from "./context-interpreter.js";

describe("context interpreter", () => {
  it("extracts a commitment with deadline", () => {
    const candidate = interpretCommitment({
      selectedText: "Please send the revised API document by Thursday.",
      now: new Date("2026-09-17T10:00:00.000Z")
    });
    expect(candidate.proposedAction.toLowerCase()).toContain("send");
    expect(candidate.deadline).toBe("Thursday");
    expect(candidate.needsClarification).toBe(false);
    expect(candidate.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("asks for clarification when the deadline is missing", () => {
    const candidate = interpretCommitment({
      selectedText: "Please send the revised API document."
    });
    expect(candidate.needsClarification).toBe(true);
  });

  it("refuses secrets", () => {
    const candidate = interpretCommitment({
      selectedText: "password=supersecret please send this"
    });
    expect(candidate.status).toBe("FAILED");
    expect(candidate.selectedText).toBe("[redacted]");
  });

  it("uses a stable idempotency key", () => {
    expect(idempotencyKeyFor("Hello", "https://x")).toBe(
      idempotencyKeyFor("hello", "https://x")
    );
  });
});
