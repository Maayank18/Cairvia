import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createAppKernel } from "@cairvia/local-store";
import { createApi } from "@cairvia/api";
import { evaluateCedar } from "@cairvia/policy";
import { invokeDeterministicAgent } from "../../services/agent-runtime/src/tools.ts";

describe("Phase 3 production contract", () => {
  it("serves versioned routes, audit, recovery, and authorization", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cairvia-p3-"));
    const kernel = await createAppKernel(path.join(dir, "cairvia.sqlite"));
    const app = createApi(kernel);
    const active = await app.request("/threads/active");
    const { thread } = (await active.json()) as {
      thread: { id: string; intent: string; blockers: string[]; nextAction: string };
    };
    expect(thread.intent).toBe("Launch authentication");
    expect(thread.blockers[0]).toBe("SMTP timeout");
    expect(thread.nextAction).toBe("inspect transporter logs");

    const listed = await app.request("/v1/threads");
    expect(listed.status).toBe(200);
    const recovered = await app.request(`/v1/threads/${thread.id}/recover`, {
      method: "POST"
    });
    expect(recovered.status).toBe(200);
    const planned = await app.request(`/v1/threads/${thread.id}/next-action`, {
      method: "POST"
    });
    const plan = (await planned.json()) as { invented: boolean; nextAction: string };
    expect(plan.invented).toBe(false);
    expect(plan.nextAction).toBe("inspect transporter logs");

    const audit = await app.request("/v1/audit");
    expect(audit.status).toBe(200);
    const { events } = (await audit.json()) as { events: { type: string }[] };
    expect(events.length).toBeGreaterThan(0);

    const commitments = await app.request("/commitments");
    const { commitments: rows } = (await commitments.json()) as {
      commitments: { id: string; proposedAction: string; status: string }[];
    };
    expect(rows[0]?.proposedAction.toLowerCase()).toContain("send");
    expect(rows[0]?.status).toBe("WAITING_FOR_USER");

    expect(evaluateCedar({ action: "READ_CONTEXT" }).decision).toBe("permit");
    expect(evaluateCedar({ action: "CREATE_TASK" }).decision).toBe("forbid");
    expect(
      evaluateCedar({ action: "CREATE_TASK", userApproved: true }).decision
    ).toBe("permit");
    expect(evaluateCedar({ action: "SEND_EXTERNAL_MESSAGE" }).decision).toBe(
      "forbid"
    );
    expect(evaluateCedar({ action: "DELETE_DATA" }).decision).toBe("forbid");

    const spoken = await invokeDeterministicAgent(
      kernel,
      "I have too much to do. What should I do first?"
    );
    expect(spoken.rationale).toContain("SMTP timeout");
    kernel.sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
