import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSIONS } from "@cairvia/schemas";
import {
  StaleWriteError,
  SyncHub,
  ThreadService,
  MemoryThreadStore,
  buildContextPacket
} from "@cairvia/domain";
import { createAppKernel } from "@cairvia/local-store";
import { createApi } from "@cairvia/api";

function tempDb(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cairvia-sync-")), "cairvia.sqlite");
}

describe("three-surface sync", () => {
  it("deduplicates the same eventId", () => {
    const hub = new SyncHub();
    const seen: string[] = [];
    hub.subscribe((event) => seen.push(event.eventId));
    const first = hub.publish({
      eventId: "sync_same",
      type: "THREAD_UPDATED",
      userId: "local",
      source: "ORB",
      version: 1,
      payload: {}
    });
    const second = hub.publish({
      eventId: "sync_same",
      type: "THREAD_UPDATED",
      userId: "local",
      source: "WEB",
      version: 2,
      payload: {}
    });
    expect(first?.eventId).toBe("sync_same");
    expect(second).toBeNull();
    expect(seen).toEqual(["sync_same"]);
  });

  it("rejects a stale expectedVersion (Orb vs Website)", async () => {
    const service = new ThreadService(new MemoryThreadStore());
    const thread = await service.createThread({
      intent: "Debug authentication issue",
      desiredOutcome: "Auth works",
      currentState: "inspecting logs",
      nextAction: "open mailer.ts",
      blockers: [],
      decisions: [],
      evidenceRefs: [],
      status: "DRAFT",
      confidence: 0.8,
      nextActionRequest: null
    });
    await service.updateThread(thread.id, {
      schemaVersion: SCHEMA_VERSIONS.threadUpdate,
      nextAction: "inspect transporter logs",
      expectedVersion: thread.version ?? 1
    });
    await expect(
      service.updateThread(thread.id, {
        schemaVersion: SCHEMA_VERSIONS.threadUpdate,
        nextAction: "stale client write",
        expectedVersion: thread.version ?? 1
      })
    ).rejects.toBeInstanceOf(StaleWriteError);
  });

  it("Orb mutation is visible to the HTTP API without refresh", async () => {
    const kernel = await createAppKernel(tempDb());
    const app = createApi(kernel);
    const received: string[] = [];
    kernel.hub?.subscribe((event) => received.push(event.type));
    await kernel.threads.updateThread(kernel.seed.id, {
      schemaVersion: SCHEMA_VERSIONS.threadUpdate,
      currentState: "debugging from Orb"
    });
    const listed = await app.request("/threads/active");
    const body = (await listed.json()) as { thread: { currentState: string } };
    expect(body.thread.currentState).toBe("debugging from Orb");
    expect(received).toContain("THREAD_UPDATED");
    kernel.sqlite.close();
  });

  it("Website mutation is visible to Orb kernel readers", async () => {
    const kernel = await createAppKernel(tempDb());
    const app = createApi(kernel);
    await app.request(`/threads/${kernel.seed.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schemaVersion: SCHEMA_VERSIONS.threadUpdate,
        nextAction: "compare Lambda timeout"
      })
    });
    const thread = await kernel.threads.getActiveThread();
    expect(thread?.nextAction).toBe("compare Lambda timeout");
    kernel.sqlite.close();
  });

  it("Extension capture lands on the same Work Thread", async () => {
    const kernel = await createAppKernel(tempDb());
    const app = createApi(kernel);
    const posted = await app.request("/context/selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedText: "Please send the deployment report by Friday.",
        pageTitle: "Mail",
        pageUrl: "https://mail.example/msg"
      })
    });
    expect(posted.status).toBe(200);
    const commitments = await kernel.store.listCommitments();
    expect(commitments[0]?.threadId).toBe(kernel.seed.id);
    kernel.sqlite.close();
  });

  it("builds a bounded context packet", async () => {
    const kernel = await createAppKernel(tempDb());
    const packet = await buildContextPacket(kernel.store, kernel.seed);
    expect(packet.threadId).toBe(kernel.seed.id);
    expect(packet.evidenceRefs.length).toBeLessThanOrEqual(6);
    kernel.sqlite.close();
  });
});
