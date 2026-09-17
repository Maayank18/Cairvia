import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  ActionRequestV1Schema,
  ProgressNoteV1Schema,
  SCHEMA_VERSIONS,
  ThreadUpdateV1Schema,
  UserPreferencesV1Schema
} from "@cairvia/schemas";
import { LOCAL_API_ORIGIN } from "@cairvia/config";
import {
  applyCommitmentDecision,
  mergeEvidence,
  planNextAction,
  runCommitmentCapture,
  threadPatchFromCommitment,
  type ContinuityService,
  type ThreadService,
  type ThreadStore,
  StaleWriteError,
  SyncHub,
  buildContextPacket,
  syncSourceFromActor
} from "@cairvia/domain";
import {
  authorize,
  createActionRegistry,
  createNodeExecutors,
  newActionId
} from "@cairvia/action-runtime";

export type AppKernel = {
  store: ThreadStore;
  threads: ThreadService;
  continuity: ContinuityService;
  hub?: SyncHub;
  userId?: string;
  emitContextCaptured?: (detail: {
    userId: string;
    threadId: string | null;
    contextId: string;
    selectedText: string;
    pageTitle?: string;
    pageUrl?: string;
  }) => Promise<void>;
  onCommitmentDecided?: (
    commitmentId: string,
    decision: "add" | "reject"
  ) => Promise<void>;
};

export async function decideCommitment(
  kernel: AppKernel,
  id: string,
  decision: "add" | "reject",
  proposedAction?: string,
  deadline?: string | null
) {
  const current = await kernel.store.getCommitment(id);
  if (!current) {
    throw new Error("Commitment not found");
  }
  const updated = applyCommitmentDecision(
    current,
    decision,
    proposedAction,
    deadline
  );
  await kernel.store.saveCommitment(updated);
  await kernel.store.appendEvent({
    schemaVersion: SCHEMA_VERSIONS.executionEvent,
    id: `evt_${newActionId()}`,
    type: decision === "add" ? "user_confirmed" : "user_rejected",
    actor: "user",
    action: decision === "add" ? "user_confirmed" : "user_rejected",
    resource: id,
    authorizationResult: "allow",
    payload: { decision },
    createdAt: new Date().toISOString()
  });
  await kernel.onCommitmentDecided?.(id, decision);
  if (decision !== "add") {
    return { candidate: updated, thread: null };
  }
  let thread = updated.threadId
    ? await kernel.threads.getThread(updated.threadId).catch(() => null)
    : await kernel.threads.getActiveThread();
  const patch = threadPatchFromCommitment(updated);
  if (!thread) {
    thread = await kernel.threads.createThread({
      intent: updated.proposedAction,
      desiredOutcome: updated.proposedAction,
      currentState: "Commitment captured from browser",
      nextAction: patch.nextAction,
      blockers: [],
      decisions: [],
      evidenceRefs: patch.evidenceRefs ?? [],
      status: "DRAFT",
      confidence: updated.confidence,
      nextActionRequest: null
    });
  } else {
    thread = await kernel.threads.updateThread(thread.id, {
      schemaVersion: SCHEMA_VERSIONS.threadUpdate,
      nextAction: patch.nextAction,
      evidenceRefs: mergeEvidence(thread, patch.evidenceRefs ?? [])
    });
  }
  await kernel.store.appendEvent({
    schemaVersion: SCHEMA_VERSIONS.executionEvent,
    id: `evt_${newActionId()}`,
    type: "thread_updated",
    actor: "commitment_workflow",
    action: "thread_updated",
    resource: thread.id,
    payload: { commitmentId: updated.id },
    createdAt: new Date().toISOString()
  });
  return { candidate: updated, thread };
}

function allowedOrigin(origin: string): string | undefined {
  if (!origin) {
    return undefined;
  }
  if (
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://") ||
    origin.startsWith("extension://")
  ) {
    return origin;
  }
  if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) {
    return origin;
  }
  if (origin === LOCAL_API_ORIGIN || origin === process.env.CAIRVIA_WEB_ORIGIN) {
    return origin;
  }
  return undefined;
}

export function createApi(kernel: AppKernel) {
  const app = new Hono();
  const runtime = createActionRegistry(createNodeExecutors());
  const hub = kernel.hub ?? new SyncHub();
  kernel.hub = hub;
  let networkOnline = true;

  app.use(
    "*",
    cors({
      origin: (origin) => allowedOrigin(origin ?? "") ?? "http://127.0.0.1:5173",
      allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-Cairvia-Source"]
    })
  );

  app.get("/health", (c) => c.json({ ok: true, product: "cairvia" }));

  app.get("/v1/sync/stream", (c) => {
    const encoder = new TextEncoder();
    let unsubscribe: () => void = () => undefined;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: HELLO\ndata: ${JSON.stringify({ ok: true })}\n\n`)
        );
        unsubscribe = hub.subscribe((event) => {
          try {
            controller.enqueue(
              encoder.encode(
                `id: ${event.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
              )
            );
          } catch {
            unsubscribe();
          }
        });
      },
      cancel() {
        unsubscribe();
      }
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    });
  });

  app.get("/v1/context-packet", async (c) => {
    const thread = await kernel.threads.getActiveThread();
    return c.json({ packet: await buildContextPacket(kernel.store, thread) });
  });

  app.get("/status", async (c) => {
    const pending = await kernel.store.listPendingSync();
    return c.json({
      mode: networkOnline ? "local" : "offline",
      message: networkOnline
        ? "Using local Work Thread."
        : "You're offline. Your last saved context is available.",
      pendingSync: pending.length
    });
  });

  app.post("/status/offline", async (c) => {
    const body = await c.req.json();
    networkOnline = Boolean(body.online);
    if (networkOnline) {
      const pending = await kernel.store.listPendingSync();
      for (const item of pending) {
        await kernel.store.markSync(item.id, "SYNCED");
      }
    }
    return c.json({ online: networkOnline });
  });

  app.get("/threads", async (c) => {
    return c.json({ threads: await kernel.threads.listThreads() });
  });

  app.get("/threads/active", async (c) => {
    return c.json({ thread: await kernel.threads.getActiveThread() });
  });

  app.get("/recovery/card", async (c) => {
    await kernel.store.appendEvent({
      schemaVersion: SCHEMA_VERSIONS.executionEvent,
      id: `evt_${newActionId()}`,
      type: "agent_started",
      actor: "recovery_agent",
      action: "agent_started",
      resource: "resume_card",
      payload: {},
      createdAt: new Date().toISOString()
    });
    const card = await kernel.continuity.resumeCard();
    await kernel.store.appendEvent({
      schemaVersion: SCHEMA_VERSIONS.executionEvent,
      id: `evt_${newActionId()}`,
      type: "recommendation_generated",
      actor: "recovery_agent",
      action: "recommendation_generated",
      resource: card.threadId ?? "none",
      payload: { confidence: card.confidence },
      createdAt: new Date().toISOString()
    });
    return c.json({ card });
  });

  app.get("/threads/:id", async (c) => {
    return c.json({ thread: await kernel.threads.getThread(c.req.param("id")) });
  });

  app.post("/threads/:id/pause", async (c) => {
    return c.json({ thread: await kernel.threads.pauseThread(c.req.param("id")) });
  });

  app.post("/threads/:id/resume", async (c) => {
    return c.json({ thread: await kernel.threads.resumeThread(c.req.param("id")) });
  });

  app.post("/threads/:id/complete", async (c) => {
    return c.json({
      thread: await kernel.threads.completeThread(c.req.param("id"))
    });
  });

  app.post("/threads/:id/recovery", async (c) => {
    return c.json({
      thread: await kernel.threads.captureRecovery(c.req.param("id"))
    });
  });

  app.post("/threads/:id/snapshot", async (c) => {
    const thread = await kernel.threads.getThread(c.req.param("id"));
    const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
    const snapshot = await kernel.continuity.snapshotThread(
      thread,
      body.reason ?? "save this context",
      ["user.snapshot"]
    );
    return c.json({ snapshot });
  });

  app.get("/threads/:id/recovery", async (c) => {
    return c.json(await kernel.threads.getRecovery(c.req.param("id")));
  });

  app.put("/threads/:id", async (c) => {
    const patch = ThreadUpdateV1Schema.parse(await c.req.json());
    return c.json({
      thread: await kernel.threads.updateThread(c.req.param("id"), patch)
    });
  });

  app.post("/threads/:id/progress", async (c) => {
    const note = ProgressNoteV1Schema.parse(await c.req.json());
    return c.json({
      thread: await kernel.threads.markProgress(c.req.param("id"), note)
    });
  });

  app.post("/actions", async (c) => {
    const raw = (await c.req.json()) as Record<string, unknown>;
    const body = ActionRequestV1Schema.parse({
      schemaVersion: SCHEMA_VERSIONS.actionRequest,
      id: newActionId(),
      toolId: raw.toolId,
      threadId: raw.threadId,
      input: raw.input ?? {},
      idempotencyKey: raw.idempotencyKey ?? `idemp_${newActionId()}`,
      confirmed: raw.confirmed
    });
    const permissions = await kernel.store.listPermissions();
    try {
      if (raw.recordOnly) {
        authorize(permissions, body);
        await kernel.store.appendEvent({
          schemaVersion: SCHEMA_VERSIONS.executionEvent,
          id: `evt_${body.id}`,
          type: "action_executed",
          threadId: body.threadId,
          actionId: body.id,
          actor: "action_broker",
          action: body.toolId,
          resource: body.threadId ?? body.toolId,
          authorizationResult: "allow",
          correlationId: body.idempotencyKey,
          payload: {
            toolId: body.toolId,
            status: raw.status ?? "SUCCEEDED",
            recorded: true
          },
          createdAt: new Date().toISOString()
        });
        hub.publish({
          type: "ACTION_SUCCEEDED",
          userId: kernel.userId ?? "local",
          threadId: body.threadId,
          source: syncSourceFromActor("action_broker"),
          version: 0,
          payload: { toolId: body.toolId, status: raw.status ?? "SUCCEEDED", actionId: body.id }
        });
        return c.json({
          result: {
            schemaVersion: SCHEMA_VERSIONS.actionResult,
            actionId: body.id,
            status: raw.status ?? "SUCCEEDED",
            message: raw.message ?? "Recorded",
            verified: Boolean(raw.verified ?? true),
            at: new Date().toISOString(),
            authorizationResult: "allow"
          }
        });
      }
      const result = await runtime.execute(body, permissions);
      await kernel.store.appendEvent({
        schemaVersion: SCHEMA_VERSIONS.executionEvent,
        id: `evt_${body.id}`,
        type:
          result.status === "SUCCEEDED" ? "action_executed" : "action_failed",
        threadId: body.threadId,
        actionId: body.id,
        actor: "action_broker",
        action: body.toolId,
        resource: body.threadId ?? body.toolId,
        authorizationResult: result.authorizationResult,
        correlationId: body.idempotencyKey,
        payload: { toolId: body.toolId, status: result.status },
        createdAt: new Date().toISOString()
      });
      hub.publish({
        type: result.status === "SUCCEEDED" ? "ACTION_SUCCEEDED" : "ACTION_FAILED",
        userId: kernel.userId ?? "local",
        threadId: body.threadId,
        source: syncSourceFromActor("action_broker"),
        version: 0,
        payload: { toolId: body.toolId, status: result.status, actionId: body.id }
      });
      return c.json({ result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      await kernel.store.appendEvent({
        schemaVersion: SCHEMA_VERSIONS.executionEvent,
        id: `evt_fail_${body.id}`,
        type: "action_failed",
        actor: "action_broker",
        action: body.toolId,
        resource: body.toolId,
        authorizationResult: "deny",
        payload: { message },
        createdAt: new Date().toISOString()
      });
      return c.json({ error: message }, 400);
    }
  });

  app.post("/context/selection", async (c) => {
    const body = (await c.req.json()) as {
      selectedText?: string;
      pageTitle?: string;
      pageUrl?: string;
      threadId?: string;
    };
    if (!body.selectedText?.trim()) {
      return c.json({ error: "No selected text" }, 400);
    }
    await kernel.store.appendEvent({
      schemaVersion: SCHEMA_VERSIONS.executionEvent,
      id: `evt_${newActionId()}`,
      type: "context_read",
      actor: "context_interpreter",
      action: "context_read",
      resource: "browser.selection",
      payload: { length: body.selectedText.length },
      createdAt: new Date().toISOString()
    });
    const active = body.threadId
      ? await kernel.threads.getThread(body.threadId).catch(() => null)
      : await kernel.threads.getActiveThread();
    const contextId = `ctx_${newActionId()}`;
    const { candidate, duplicate } = await runCommitmentCapture({
      selectedText: body.selectedText,
      pageTitle: body.pageTitle,
      pageUrl: body.pageUrl,
      threadId: active?.id ?? null,
      store: {
        getByIdempotency: (key) => kernel.store.getCommitmentByIdempotency(key),
        saveCommitment: (item) => kernel.store.saveCommitment(item)
      }
    });
    await kernel.store.appendEvent({
      schemaVersion: SCHEMA_VERSIONS.executionEvent,
      id: `evt_${newActionId()}`,
      type: "commitment.extracted",
      actor: "context_interpreter",
      action: "commitment.extracted",
      resource: candidate.id,
      correlationId: candidate.idempotencyKey,
      payload: { duplicate, confidence: candidate.confidence },
      createdAt: new Date().toISOString()
    });
    const capturedAt = new Date().toISOString();
    await kernel.store.insertContextItem({
      schemaVersion: SCHEMA_VERSIONS.contextItem,
      id: contextId,
      threadId: active?.id ?? null,
      type: "COMMITMENT_CANDIDATE",
      value: body.selectedText.slice(0, 500),
      source: "browser.selection",
      timestamp: capturedAt,
      confidence: candidate.confidence,
      lifecycle: "CANDIDATE",
      userConfirmed: false,
      createdAt: capturedAt,
      lastConfirmedAt: null
    });
    await kernel.emitContextCaptured?.({
      userId: kernel.userId ?? "local",
      threadId: active?.id ?? null,
      contextId,
      selectedText: body.selectedText,
      pageTitle: body.pageTitle,
      pageUrl: body.pageUrl
    });
    return c.json({ candidate, duplicate });
  });

  app.get("/commitments", async (c) => {
    return c.json({ commitments: await kernel.store.listCommitments() });
  });

  app.post("/commitments/:id/decide", async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json()) as {
      decision: "add" | "reject";
      proposedAction?: string;
      deadline?: string | null;
    };
    return c.json(
      await decideCommitment(
        kernel,
        id,
        body.decision,
        body.proposedAction,
        body.deadline
      )
    );
  });

  app.get("/preferences", async (c) => {
    return c.json({ preferences: await kernel.store.getPreferences() });
  });

  app.put("/preferences", async (c) => {
    const prefs = UserPreferencesV1Schema.parse(await c.req.json());
    await kernel.store.savePreferences(prefs);
    return c.json({ preferences: prefs });
  });

  app.get("/permissions", async (c) => {
    return c.json({ permissions: await kernel.store.listPermissions() });
  });

  app.get("/events", async (c) => {
    return c.json({ events: await kernel.store.listEvents(80) });
  });

  app.get("/automations", async (c) => {
    const commitments = await kernel.store.listCommitments();
    return c.json({
      automations: [
        {
          name: "Commitment Capture",
          trigger: "Browser selected text",
          steps: [
            "Event emitted",
            "Extract",
            "Validate",
            "User approval",
            "Persist",
            "Update Work Thread"
          ],
          runs: commitments
        }
      ]
    });
  });

  app.get("/v1/threads", async (c) => {
    return c.json({ threads: await kernel.threads.listThreads() });
  });
  app.post("/v1/threads", async (c) => {
    const body = (await c.req.json()) as Parameters<
      ThreadService["createThread"]
    >[0];
    return c.json({ thread: await kernel.threads.createThread(body) }, 201);
  });
  app.get("/v1/threads/:id", async (c) => {
    return c.json({ thread: await kernel.threads.getThread(c.req.param("id")) });
  });
  app.post("/v1/threads/:id/recover", async (c) => {
    return c.json({
      thread: await kernel.threads.captureRecovery(c.req.param("id"))
    });
  });
  app.post("/v1/threads/:id/next-action", async (c) => {
    const thread = await kernel.threads.getThread(c.req.param("id"));
    return c.json(planNextAction(thread));
  });
  app.post("/v1/commitments/:id/approve", async (c) => {
    return c.json(
      await decideCommitment(kernel, c.req.param("id"), "add")
    );
  });
  app.post("/v1/commitments/:id/reject", async (c) => {
    return c.json(
      await decideCommitment(kernel, c.req.param("id"), "reject")
    );
  });
  app.get("/v1/audit", async (c) => {
    return c.json({ events: await kernel.store.listEvents(80) });
  });

  app.onError((error, c) => {
    if (error instanceof StaleWriteError) {
      return c.json({ error: error.message, code: "STALE_WRITE" }, 409);
    }
    return c.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      400
    );
  });

  return app;
}
