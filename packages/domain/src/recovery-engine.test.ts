import { describe, expect, it } from "vitest";
import { SCHEMA_VERSIONS, defaultUserPreferences, type WorkThreadV1 } from "@cairvia/schemas";
import { buildResumeCard } from "./recovery-engine.js";

function thread(partial: Partial<WorkThreadV1>): WorkThreadV1 {
  const base: WorkThreadV1 = {
    schemaVersion: SCHEMA_VERSIONS.workThread,
    id: "thr_1",
    intent: "Fix authentication",
    desiredOutcome: "OTP registration works end-to-end",
    currentState: "SMTP transport configured",
    nextAction: "Run mailer health check",
    blockers: ["SMTP connectivity not verified"],
    decisions: [],
    evidenceRefs: [],
    lastValidatedAt: "2026-09-17T10:00:00.000Z",
    status: "RECOVERABLE",
    createdAt: "2026-09-17T09:00:00.000Z",
    updatedAt: "2026-09-17T10:00:00.000Z",
    confidence: 0.93,
    recoveryCapsule: null,
    userPreferencesSnapshot: defaultUserPreferences(),
    nextActionRequest: null,
    version: 1
  };
  return {
    ...base,
    ...partial,
    version: partial.version ?? base.version
  };
}

describe("RecoveryEngine", () => {
  it("returns an empty card when there is no saved context", () => {
    const card = buildResumeCard({ threads: [], snapshots: [] });
    expect(card.threadId).toBeNull();
    expect(card.nextAction).toContain("Start or capture");
  });

  it("does not invent a missing next action", () => {
    const card = buildResumeCard({
      threads: [thread({ nextAction: " " })],
      snapshots: []
    });
    expect(card.nextAction).toBe("No next action is stored. Add one to continue.");
  });

  it("mentions a second interrupted thread", () => {
    const card = buildResumeCard({
      threads: [
        thread({ id: "thr_a", updatedAt: "2026-09-17T12:00:00.000Z" }),
        thread({
          id: "thr_b",
          intent: "Fix deployment",
          updatedAt: "2026-09-17T11:00:00.000Z"
        })
      ],
      snapshots: []
    });
    expect(card.alsoInterrupted.some((t) => t.intent === "Fix deployment")).toBe(
      true
    );
  });

  it("marks stale capsules", () => {
    const card = buildResumeCard({
      now: new Date("2026-09-17T14:00:00.000Z"),
      threads: [
        thread({
          recoveryCapsule: {
            schemaVersion: SCHEMA_VERSIONS.recoveryCapsule,
            id: "cap_1",
            threadId: "thr_1",
            intent: "Fix authentication",
            currentState: "SMTP configured",
            nextAction: "Run mailer health check",
            blockers: ["timeout"],
            lastKnownDecision: null,
            evidenceRefs: [],
            capturedAt: "2026-09-17T10:00:00.000Z",
            confidence: 0.9,
            staleAfterMinutes: 120
          }
        })
      ],
      snapshots: []
    });
    expect(card.stale).toBe(true);
    expect(card.evidenceLabel).toBe("Stale");
  });
});
