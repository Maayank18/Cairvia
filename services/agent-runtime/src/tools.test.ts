import { describe, expect, it } from "vitest";
import { ContinuityService, MemoryThreadStore, ThreadService } from "@cairvia/domain";
import { invokeDeterministicAgent, runBoundedTool } from "./tools.js";

describe("bounded agent tools", () => {
  it("does not invent a next action", async () => {
    const store = new MemoryThreadStore();
    const threads = new ThreadService(store);
    const kernel = {
      store,
      threads,
      continuity: new ContinuityService(store)
    };
    await threads.createThread({
      project: "CodeArena",
      intent: "Launch authentication",
      desiredOutcome: "OTP registration",
      currentState: "health check attempted",
      nextAction: "inspect transporter logs",
      blockers: ["SMTP timeout"],
      decisions: [],
      evidenceRefs: ["health check attempted"],
      status: "DRAFT",
      confidence: 0.9,
      nextActionRequest: null
    });
    const planned = await runBoundedTool(kernel, "propose_next_action");
    expect(planned).toMatchObject({
      nextAction: "inspect transporter logs",
      invented: false
    });
    const spoken = await invokeDeterministicAgent(
      kernel,
      "I have too much to do. What should I do first?"
    );
    expect(spoken.rationale).toContain("SMTP timeout");
    expect(spoken.toolCalls).toContain("get_active_thread");
  });
});
