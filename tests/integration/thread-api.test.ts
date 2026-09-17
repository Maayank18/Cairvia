import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createAppKernel } from "@cairvia/local-store";
import { createApi } from "@cairvia/api";
import { SCHEMA_VERSIONS } from "@cairvia/schemas";

const dirs: string[] = [];

function tempDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cairvia-int-"));
  dirs.push(dir);
  return path.join(dir, "cairvia.sqlite");
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("Thread lifecycle over local API", () => {
  it("reads, resumes, executes a LOW action, and captures recovery", async () => {
    const kernel = await createAppKernel(tempDb());
    const app = createApi(kernel);
    const active = await app.request("/threads/active");
    expect(active.status).toBe(200);
    const { thread } = (await active.json()) as { thread: { id: string; intent: string } };
    expect(thread.intent).toBe("Launch authentication");

    const resumed = await app.request(`/threads/${thread.id}/resume`, { method: "POST" });
    expect(resumed.status).toBe(200);

    const focused = await app.request("/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolId: "start_focus",
        threadId: thread.id,
        input: { threadId: thread.id }
      })
    });
    expect(focused.status).toBe(200);
    const focusJson = (await focused.json()) as { result: { status: string } };
    expect(focusJson.result.status).toBe("SUCCEEDED");

    const progress = await app.request(`/threads/${thread.id}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schemaVersion: SCHEMA_VERSIONS.progressNote,
        note: "Prepared mailer health check",
        done: true
      })
    });
    expect(progress.status).toBe(200);

    const captured = await app.request(`/threads/${thread.id}/recovery`, {
      method: "POST"
    });
    expect(captured.status).toBe(200);
    const body = (await captured.json()) as {
      thread: { recoveryCapsule: { nextAction: string } | null };
    };
    expect(body.thread.recoveryCapsule?.nextAction).toBe("inspect transporter logs");

    const pending = await kernel.store.listPendingSync();
    expect(pending.length).toBeGreaterThan(0);
    kernel.sqlite.close();
  });
});
