import { describe, expect, it } from "vitest";
import { SCHEMA_VERSIONS, type RecoveryCapsuleV1 } from "@cairvia/schemas";
import { capsuleFreshness, isCapsuleStale } from "./stale.js";

const capsule = (capturedAt: string): RecoveryCapsuleV1 => ({
  schemaVersion: SCHEMA_VERSIONS.recoveryCapsule,
  id: "cap_1",
  threadId: "thr_1",
  intent: "Fix authentication",
  currentState: "SMTP configured",
  nextAction: "Run mailer health check",
  blockers: [],
  lastKnownDecision: null,
  evidenceRefs: [],
  capturedAt,
  confidence: 0.9,
  staleAfterMinutes: 120
});

describe("stale detection", () => {
  it("is fresh within the first half of the window", () => {
    expect(
      capsuleFreshness(
        capsule("2026-09-17T10:00:00.000Z"),
        new Date("2026-09-17T11:00:00.000Z")
      )
    ).toBe("FRESH");
    expect(
      isCapsuleStale(
        capsule("2026-09-17T10:00:00.000Z"),
        new Date("2026-09-17T11:00:00.000Z")
      )
    ).toBe(false);
  });

  it("is aging in the second half of the window", () => {
    expect(
      capsuleFreshness(
        capsule("2026-09-17T10:00:00.000Z"),
        new Date("2026-09-17T11:30:00.000Z")
      )
    ).toBe("AGING");
  });

  it("is stale after the window", () => {
    expect(
      isCapsuleStale(
        capsule("2026-09-17T10:00:00.000Z"),
        new Date("2026-09-17T13:00:00.000Z")
      )
    ).toBe(true);
  });
});
