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
  createActionRegistry,
  createNodeExecutors,
  newActionId
} from "@cairvia/action-runtime";
import type { createAppKernel } from "@cairvia/local-store";

export type AppKernel = Awaited<ReturnType<typeof createAppKernel>>;

export function createApi(kernel: AppKernel) {
  const app = new Hono();
  const runtime = createActionRegistry(createNodeExecutors());
  let networkOnline = true;

  app.use(
    "*",
    cors({
      origin: [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        LOCAL_API_ORIGIN
      ],
      allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
      allowHeaders: ["Content-Type"]
    })
  );

  app.get("/health", (c) => c.json({ ok: true, product: "cairvia" }));

  app.get("/status", async (c) => {
    const pending = await kernel.store.listPendingSync();
    return c.json({
      mode: networkOnline ? "local" : "offline",
      message: networkOnline
        ? "Using local Work Thread."
        : "Offline — using local Work Thread.",
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
      idempotencyKey: raw.idempotencyKey ?? `idemp_${newActionId()}`
    });
    const permissions = await kernel.store.listPermissions();
    try {
      const result = await runtime.execute(body, permissions);
      await kernel.store.appendEvent({
        schemaVersion: SCHEMA_VERSIONS.executionEvent,
        id: `evt_${body.id}`,
        type: "action.executed",
        threadId: body.threadId,
        actionId: body.id,
        payload: { toolId: body.toolId, status: result.status },
        createdAt: new Date().toISOString()
      });
      return c.json({ result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      return c.json({ error: message }, 400);
    }
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
    return c.json({ events: await kernel.store.listEvents(50) });
  });

  app.get("/automations", (c) => {
    return c.json({
      automations: [],
      emptyState: "No automations yet. Later phases will add runs here."
    });
  });

  app.onError((error, c) => {
    return c.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      400
    );
  });

  return app;
}
