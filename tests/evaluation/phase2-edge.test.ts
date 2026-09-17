import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ThreadService } from "@cairvia/domain";
import { SCHEMA_VERSIONS } from "@cairvia/schemas";
import { createAppKernel } from "@cairvia/local-store";
import { createApi } from "@cairvia/api";

function tempDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cairvia-p2-"));
  return path.join(dir, "cairvia.sqlite");
}

describe("Phase 2 edge cases", () => {
  it("recovers after close/reopen with an evidence-based resume card", async () => {
    const dbPath = tempDb();
    const first = await createAppKernel(dbPath);
    await first.threads.resumeThread(first.seed.id);
    await first.threads.captureRecovery(first.seed.id);
    first.sqlite.close();

    const second = await createAppKernel(dbPath);
    const card = await second.continuity.resumeCard();
    expect(card.threadId).toBe(first.seed.id);
    expect(card.nextAction).toContain("transporter");
    expect(card.whatIWasDoing).toContain("authentication");
    second.sqlite.close();
  });

  it("keeps the last known next action when the user edits it", async () => {
    const kernel = await createAppKernel(tempDb());
    const updated = await kernel.threads.updateThread(kernel.seed.id, {
      schemaVersion: SCHEMA_VERSIONS.threadUpdate,
      nextAction: "Inspect recent Lambda logs"
    });
    expect(updated.nextAction).toBe("Inspect recent Lambda logs");
    const card = await kernel.continuity.resumeCard();
    expect(card.nextAction).toBe("Inspect recent Lambda logs");
    kernel.sqlite.close();
  });

  it("captures the same thread twice without losing state", async () => {
    const kernel = await createAppKernel(tempDb());
    const service = new ThreadService(kernel.store);
    await service.resumeThread(kernel.seed.id);
    await service.captureRecovery(kernel.seed.id);
    await service.resumeThread(kernel.seed.id);
    const second = await service.captureRecovery(kernel.seed.id);
    const snaps = await kernel.store.listSnapshots(kernel.seed.id);
    expect(snaps.length).toBeGreaterThan(1);
    expect(second.recoveryCapsule?.threadId).toBe(kernel.seed.id);
    kernel.sqlite.close();
  });

  it("runs commitment capture end-to-end and rejects duplicates", async () => {
    const kernel = await createAppKernel(tempDb());
    const app = createApi(kernel);
    const payload = {
      selectedText: "Please send the revised API document by Thursday.",
      pageTitle: "Mail",
      pageUrl: "https://mail.example/msg"
    };
    const first = await app.request("/context/selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const second = await app.request("/context/selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    expect(first.status).toBe(200);
    const a = (await first.json()) as { candidate: { id: string } };
    const b = (await second.json()) as { duplicate: boolean; candidate: { id: string } };
    expect(b.duplicate).toBe(true);
    expect(b.candidate.id).toBe(a.candidate.id);

    const added = await app.request(`/commitments/${a.candidate.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "add" })
    });
    expect(added.status).toBe(200);
    const body = (await added.json()) as { thread: { nextAction: string } };
    expect(body.thread.nextAction.toLowerCase()).toContain("send");
    kernel.sqlite.close();
  });

  it("rejects a suggested commitment without changing next action", async () => {
    const kernel = await createAppKernel(tempDb());
    const before = (await kernel.threads.getThread(kernel.seed.id)).nextAction;
    const app = createApi(kernel);
    const created = await app.request("/context/selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedText: "Please send the deployment report by Friday.",
        pageUrl: "https://mail.example/2"
      })
    });
    const { candidate } = (await created.json()) as { candidate: { id: string } };
    await app.request(`/commitments/${candidate.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "reject" })
    });
    const after = await kernel.threads.getThread(kernel.seed.id);
    expect(after.nextAction).toBe(before);
    kernel.sqlite.close();
  });

  it("does not capture secrets from browser text", async () => {
    const kernel = await createAppKernel(tempDb());
    const app = createApi(kernel);
    const response = await app.request("/context/selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedText: "api_key=abcd1234 please send" })
    });
    const body = (await response.json()) as { candidate: { status: string } };
    expect(body.candidate.status).toBe("FAILED");
    kernel.sqlite.close();
  });
});
