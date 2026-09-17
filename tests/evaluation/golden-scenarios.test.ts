import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyInteractionMode,
  capsuleFreshness,
  evaluatePermission,
  defaultPermissions,
  interpretCommitment,
  MemoryThreadStore,
  planNextAction,
  runCommitmentCapture,
  ThreadService
} from "@cairvia/domain";
import { SCHEMA_VERSIONS, defaultUserPreferences } from "@cairvia/schemas";
import { createAppKernel } from "@cairvia/local-store";
import { createApi } from "@cairvia/api";
import { ActionDeniedError, createActionRegistry } from "@cairvia/action-runtime";
import { evaluateCedar } from "@cairvia/policy";
import { IPC_CHANNELS } from "@cairvia/schemas";

function tempDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cairvia-gold-"));
  return path.join(dir, "cairvia.sqlite");
}

describe("15 golden continuity scenarios", () => {
  it("1 create Thread", async () => {
    const service = new ThreadService(new MemoryThreadStore());
    const thread = await service.createThread({
      project: "CodeArena",
      intent: "Launch authentication",
      desiredOutcome: "Launch authentication",
      currentState: "OTP registration",
      nextAction: "inspect transporter logs",
      blockers: ["SMTP timeout"],
      decisions: [],
      evidenceRefs: ["health check attempted"],
      status: "DRAFT",
      confidence: 0.9,
      nextActionRequest: null
    });
    expect(thread.id.startsWith("thr_")).toBe(true);
    expect(thread.status).toBe("DRAFT");
  });

  it("2 start work", async () => {
    const service = new ThreadService(new MemoryThreadStore());
    const draft = await service.createThread({
      intent: "Launch authentication",
      desiredOutcome: "OTP",
      currentState: "ready",
      nextAction: "inspect transporter logs",
      blockers: [],
      decisions: [],
      evidenceRefs: [],
      status: "DRAFT",
      confidence: 0.9,
      nextActionRequest: null
    });
    expect((await service.resumeThread(draft.id)).status).toBe("ACTIVE");
  });

  it("3 choose next action without inventing", () => {
    const planned = planNextAction({
      schemaVersion: SCHEMA_VERSIONS.workThread,
      id: "thr_1",
      intent: "Launch authentication",
      desiredOutcome: "OTP",
      currentState: "health check attempted",
      nextAction: "inspect transporter logs",
      blockers: ["SMTP timeout"],
      decisions: [],
      evidenceRefs: ["health check attempted"],
      lastValidatedAt: "2026-09-17T10:00:00.000Z",
      status: "ACTIVE",
      createdAt: "2026-09-17T10:00:00.000Z",
      updatedAt: "2026-09-17T10:00:00.000Z",
      confidence: 0.9,
      recoveryCapsule: null,
      userPreferencesSnapshot: defaultUserPreferences(),
      nextActionRequest: null
    });
    expect(planned.invented).toBe(false);
    expect(planned.nextAction).toBe("inspect transporter logs");
    expect(planned.whyNow).toContain("SMTP timeout");
  });

  it("4 interruption becomes INTERRUPTED then RECOVERABLE", async () => {
    const service = new ThreadService(new MemoryThreadStore());
    const draft = await service.createThread({
      intent: "Launch authentication",
      desiredOutcome: "OTP",
      currentState: "debugging",
      nextAction: "inspect transporter logs",
      blockers: [],
      decisions: [],
      evidenceRefs: [],
      status: "DRAFT",
      confidence: 0.9,
      nextActionRequest: null
    });
    await service.resumeThread(draft.id);
    const interrupted = await service.interruptThread(draft.id);
    expect(interrupted.status).toBe("INTERRUPTED");
    const recovered = await service.captureRecovery(draft.id);
    expect(recovered.status).toBe("RECOVERABLE");
  });

  it("5 capture recovery stores an immutable capsule", async () => {
    const service = new ThreadService(new MemoryThreadStore());
    const draft = await service.createThread({
      intent: "Launch authentication",
      desiredOutcome: "OTP",
      currentState: "debugging",
      nextAction: "inspect transporter logs",
      blockers: ["SMTP timeout"],
      decisions: ["Use STARTTLS"],
      evidenceRefs: ["health check attempted"],
      status: "DRAFT",
      confidence: 0.9,
      nextActionRequest: null
    });
    await service.resumeThread(draft.id);
    const first = await service.captureRecovery(draft.id);
    await service.resumeThread(draft.id);
    const second = await service.captureRecovery(draft.id);
    expect(second.recoveryCapsule?.id).not.toBe(first.recoveryCapsule?.id);
  });

  it("6 application restart keeps the Work Thread", async () => {
    const dbPath = tempDb();
    const first = await createAppKernel(dbPath);
    const id = first.seed.id;
    first.sqlite.close();
    const second = await createAppKernel(dbPath);
    expect((await second.threads.getThread(id)).intent).toBe("Launch authentication");
    second.sqlite.close();
  });

  it("7 recovery card is evidence-based", async () => {
    const kernel = await createAppKernel(tempDb());
    const card = await kernel.continuity.resumeCard();
    expect(card.threadId).toBe(kernel.seed.id);
    expect(card.nextAction).toContain("transporter");
    kernel.sqlite.close();
  });

  it("8 stale recovery is not confirmed truth", () => {
    expect(
      capsuleFreshness(
        {
          schemaVersion: SCHEMA_VERSIONS.recoveryCapsule,
          id: "cap_1",
          threadId: "thr_1",
          intent: "Launch authentication",
          currentState: "debugging",
          nextAction: "inspect transporter logs",
          blockers: [],
          lastKnownDecision: null,
          evidenceRefs: [],
          capturedAt: "2026-09-17T10:00:00.000Z",
          confidence: 0.9,
          staleAfterMinutes: 120
        },
        new Date("2026-09-17T13:00:00.000Z")
      )
    ).toBe("STALE");
  });

  it("9 resume returns ACTIVE", async () => {
    const service = new ThreadService(new MemoryThreadStore());
    const draft = await service.createThread({
      intent: "Launch authentication",
      desiredOutcome: "OTP",
      currentState: "paused",
      nextAction: "inspect transporter logs",
      blockers: [],
      decisions: [],
      evidenceRefs: [],
      status: "DRAFT",
      confidence: 0.9,
      nextActionRequest: null
    });
    await service.resumeThread(draft.id);
    await service.captureRecovery(draft.id);
    expect((await service.resumeThread(draft.id)).status).toBe("ACTIVE");
  });

  it("10 one next action — never a plan list", () => {
    const planned = planNextAction(null);
    expect(planned.nextAction.includes("\n")).toBe(false);
    expect(planned.invented).toBe(false);
  });

  it("11 commitment extraction does not invent a deadline", () => {
    const candidate = interpretCommitment({
      selectedText: "Please send the deployment report.",
      pageUrl: "https://mail.example/msg"
    });
    expect(candidate.deadline).toBeNull();
  });

  it("12 user approval is required to create a task", () => {
    expect(evaluateCedar({ action: "CREATE_TASK" }).decision).toBe("forbid");
    expect(
      evaluateCedar({ action: "CREATE_TASK", userApproved: true }).decision
    ).toBe("permit");
  });

  it("13 authorization denial for HIGH tools", async () => {
    const { execute } = createActionRegistry({
      openUrl: async () => undefined,
      openFile: async () => undefined,
      openApp: async () => undefined,
      copyToClipboard: async () => undefined
    });
    await expect(
      execute(
        {
          schemaVersion: SCHEMA_VERSIONS.actionRequest,
          id: "act_bad",
          toolId: "delete_data",
          input: {},
          idempotencyKey: "x"
        },
        defaultPermissions(new Date().toISOString())
      )
    ).rejects.toBeInstanceOf(ActionDeniedError);
    expect(
      evaluatePermission(defaultPermissions(new Date().toISOString()), "delete_data")
    ).toBe("never");
  });

  it("14 duplicate commitment event is idempotent", async () => {
    const store = new MemoryThreadStore();
    const adapter = {
      getByIdempotency: (key: string) => store.getCommitmentByIdempotency(key),
      saveCommitment: (item: Parameters<typeof store.saveCommitment>[0]) =>
        store.saveCommitment(item)
    };
    const input = {
      selectedText: "Please send the deployment report by Friday.",
      pageUrl: "https://mail.example/msg",
      store: adapter
    };
    const first = await runCommitmentCapture(input);
    const second = await runCommitmentCapture(input);
    expect(second.duplicate).toBe(true);
    expect(second.candidate.id).toBe(first.candidate.id);
  });

  it("15 offline mode keeps last known thread", async () => {
    const kernel = await createAppKernel(tempDb());
    const app = createApi(kernel);
    const before = await app.request("/threads/active");
    const { thread } = (await before.json()) as { thread: { id: string } };
    await app.request("/status/offline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ online: false })
    });
    const after = await app.request("/threads/active");
    const body = (await after.json()) as { thread: { id: string } };
    expect(body.thread.id).toBe(thread.id);
    const status = await app.request("/status");
    const st = (await status.json()) as { message: string };
    expect(st.message).toContain("You're offline");
    expect(IPC_CHANNELS.includes("cairvia:shell:exec" as never)).toBe(false);
    expect(applyInteractionMode(defaultUserPreferences(), "CALM").execution.oneActionAtATime).toBe(
      true
    );
    kernel.sqlite.close();
  });
});
