import { describe, expect, it } from "vitest";
import { SCHEMA_VERSIONS } from "@cairvia/schemas";
import { MemoryThreadStore } from "./memory-store.js";
import { ThreadService } from "./thread-service.js";

describe("ThreadService lifecycle", () => {
  it("create → resume/pause → capture recovery → complete", async () => {
    const service = new ThreadService(new MemoryThreadStore());
    const created = await service.createThread({
      intent: "Fix authentication",
      desiredOutcome: "OTP registration works end-to-end",
      currentState: "SMTP transport configured",
      nextAction: "Run mailer health check",
      blockers: ["SMTP connectivity not verified"],
      decisions: ["Use port 587 / STARTTLS"],
      evidenceRefs: ["file:mailer.ts"],
      status: "DRAFT",
      confidence: 0.93,
      nextActionRequest: {
        schemaVersion: SCHEMA_VERSIONS.actionRequest,
        toolId: "copy_to_clipboard",
        input: { text: "curl -s http://127.0.0.1:3000/health/mailer" }
      }
    });

    const active = await service.resumeThread(created.id);
    expect(active.status).toBe("ACTIVE");

    const paused = await service.pauseThread(created.id);
    expect(paused.status).toBe("PAUSED");

    await service.resumeThread(created.id);
    const recovered = await service.captureRecovery(created.id);
    expect(recovered.status).toBe("RECOVERABLE");
    expect(recovered.recoveryCapsule?.nextAction).toBe("Run mailer health check");

    const latest = await service.getRecovery(created.id);
    expect(latest.capsule?.id).toBe(recovered.recoveryCapsule?.id);

    const done = await service.completeThread(
      (await service.resumeThread(created.id)).id
    );
    expect(done.status).toBe("COMPLETED");

    const stillActive = await service.createThread({
      intent: "Keep going",
      desiredOutcome: "Stay on the thread",
      currentState: "in progress",
      nextAction: "Continue",
      blockers: [],
      decisions: [],
      evidenceRefs: [],
      status: "DRAFT",
      confidence: 0.9,
      nextActionRequest: null
    });
    await service.resumeThread(stillActive.id);
    expect((await service.resumeThread(stillActive.id)).status).toBe("ACTIVE");
  });
});
