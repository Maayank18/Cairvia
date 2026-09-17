import { describe, expect, it } from "vitest";
import {
  WorkThreadV1Schema,
  RecoveryCapsuleV1Schema,
  defaultUserPreferences,
  SCHEMA_VERSIONS
} from "./index.js";

describe("WorkThreadV1 schema", () => {
  it("accepts a valid thread", () => {
    const thread = WorkThreadV1Schema.parse({
      schemaVersion: SCHEMA_VERSIONS.workThread,
      id: "thr_1",
      intent: "Fix authentication",
      desiredOutcome: "OTP registration works end-to-end",
      currentState: "SMTP transport configured",
      nextAction: "Run mailer health check",
      blockers: ["SMTP connectivity not verified"],
      decisions: ["Use port 587 / STARTTLS"],
      evidenceRefs: ["file:mailer.ts"],
      lastValidatedAt: "2026-09-17T03:00:00.000Z",
      status: "RECOVERABLE",
      createdAt: "2026-09-17T02:00:00.000Z",
      updatedAt: "2026-09-17T03:00:00.000Z",
      confidence: 0.93,
      recoveryCapsule: null,
      userPreferencesSnapshot: defaultUserPreferences(),
      nextActionRequest: null
    });
    expect(thread.intent).toBe("Fix authentication");
  });

  it("rejects a thread without nextAction", () => {
    expect(() =>
      WorkThreadV1Schema.parse({
        schemaVersion: SCHEMA_VERSIONS.workThread,
        id: "thr_1",
        intent: "x",
        desiredOutcome: "y",
        currentState: "z",
        blockers: [],
        decisions: [],
        evidenceRefs: [],
        lastValidatedAt: "2026-09-17T03:00:00.000Z",
        status: "ACTIVE",
        createdAt: "2026-09-17T02:00:00.000Z",
        updatedAt: "2026-09-17T03:00:00.000Z",
        confidence: 0.5,
        recoveryCapsule: null,
        userPreferencesSnapshot: defaultUserPreferences(),
        nextActionRequest: null
      })
    ).toThrow();
  });
});

describe("RecoveryCapsuleV1 schema", () => {
  it("requires staleAfterMinutes", () => {
    const capsule = RecoveryCapsuleV1Schema.parse({
      schemaVersion: SCHEMA_VERSIONS.recoveryCapsule,
      id: "cap_1",
      threadId: "thr_1",
      intent: "Fix authentication",
      currentState: "SMTP configured",
      nextAction: "Run mailer health check",
      blockers: ["timeout"],
      lastKnownDecision: "STARTTLS",
      evidenceRefs: [],
      capturedAt: "2026-09-17T03:00:00.000Z",
      confidence: 0.9,
      staleAfterMinutes: 120
    });
    expect(capsule.staleAfterMinutes).toBe(120);
  });
});
