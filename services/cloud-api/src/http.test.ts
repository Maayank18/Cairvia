import { describe, expect, it } from "vitest";
import { evaluateCedar } from "@cairvia/policy";
import { ContinuityService, MemoryThreadStore, ThreadService } from "@cairvia/domain";
import { createApi } from "@cairvia/api";

describe("cloud HTTP contract", () => {
  it("exposes versioned recovery and audit routes", async () => {
    const store = new MemoryThreadStore();
    const kernel = {
      store,
      threads: new ThreadService(store),
      continuity: new ContinuityService(store)
    };
    const app = createApi(kernel);
    const created = await kernel.threads.createThread({
      intent: "Launch authentication",
      desiredOutcome: "OTP registration works",
      currentState: "health check attempted",
      nextAction: "inspect transporter logs",
      blockers: ["SMTP timeout"],
      decisions: [],
      evidenceRefs: ["health check attempted"],
      status: "DRAFT",
      confidence: 0.9,
      nextActionRequest: null,
      project: "CodeArena"
    });
    const recover = await app.request(`/v1/threads/${created.id}/recover`, {
      method: "POST"
    });
    expect(recover.status).toBe(200);
    const audit = await app.request("/v1/audit");
    expect(audit.status).toBe(200);
    const auth = evaluateCedar({ action: "DELETE_DATA" });
    expect(auth.decision).toBe("forbid");
  });
});
