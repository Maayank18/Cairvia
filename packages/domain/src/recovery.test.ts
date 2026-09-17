import { describe, expect, it } from "vitest";
import { defaultUserPreferences, SCHEMA_VERSIONS, type WorkThreadV1 } from "@cairvia/schemas";
import { createRecoveryCapsule } from "./recovery.js";

const thread = (): WorkThreadV1 => ({
  schemaVersion: SCHEMA_VERSIONS.workThread,
  id: "thr_1",
  intent: "Fix authentication",
  desiredOutcome: "OTP registration works end-to-end",
  currentState: "SMTP transport configured",
  nextAction: "Run mailer health check",
  blockers: ["SMTP connectivity not verified"],
  decisions: ["Use port 587 / STARTTLS"],
  evidenceRefs: ["file:mailer.ts"],
  lastValidatedAt: "2026-09-17T10:00:00.000Z",
  status: "ACTIVE",
  createdAt: "2026-09-17T09:00:00.000Z",
  updatedAt: "2026-09-17T10:00:00.000Z",
  confidence: 0.93,
  recoveryCapsule: null,
  userPreferencesSnapshot: defaultUserPreferences(),
  nextActionRequest: null
});

describe("recovery capsule creation", () => {
  it("snapshots thread state and last decision", () => {
    const capsule = createRecoveryCapsule(thread(), "2026-09-17T10:42:00.000Z", 120);
    expect(capsule.threadId).toBe("thr_1");
    expect(capsule.lastKnownDecision).toBe("Use port 587 / STARTTLS");
    expect(capsule.nextAction).toBe("Run mailer health check");
    expect(capsule.staleAfterMinutes).toBe(120);
  });
});
