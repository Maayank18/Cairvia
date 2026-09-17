import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { LOCAL_API_ORIGIN } from "@cairvia/config";
import {
  ActionRequestV1Schema,
  IPC_CHANNELS,
  ProgressNoteV1Schema,
  SCHEMA_VERSIONS,
  ThreadUpdateV1Schema,
  UserPreferencesV1Schema,
  type ActionPermissionV1,
  type ActionResultV1,
  type IpcChannel,
  type WorkThreadV1
} from "@cairvia/schemas";
import {
  createActionRegistry,
  newActionId,
  type OsExecutors
} from "@cairvia/action-runtime";
import type { AppKernel } from "@cairvia/api";

const ALLOWED = new Set<string>(IPC_CHANNELS);

function bindHandlers(
  handlers: Record<IpcChannel, (payload: unknown) => Promise<unknown>>
): void {
  ipcMain.handle(
    "cairvia:invoke",
    async (_event: IpcMainInvokeEvent, channel: string, payload: unknown) => {
      if (!ALLOWED.has(channel)) {
        throw new Error(`Blocked IPC channel: ${channel}`);
      }
      return handlers[channel as IpcChannel](payload);
    }
  );
}

export function registerIpc(kernel: AppKernel, executors: OsExecutors): void {
  const runtime = createActionRegistry(executors);

  bindHandlers({
    "cairvia:thread:getActive": async () => kernel.threads.getActiveThread(),
    "cairvia:thread:get": async (payload) => {
      const { id } = (payload as { id: string }) ?? {};
      return kernel.threads.getThread(id);
    },
    "cairvia:thread:list": async () => kernel.threads.listThreads(),
    "cairvia:thread:update": async (payload) => {
      const body = payload as { id: string; patch: unknown };
      return kernel.threads.updateThread(
        body.id,
        ThreadUpdateV1Schema.parse(body.patch)
      );
    },
    "cairvia:thread:pause": async (payload) =>
      kernel.threads.pauseThread((payload as { id: string }).id),
    "cairvia:thread:resume": async (payload) =>
      kernel.threads.resumeThread((payload as { id: string }).id),
    "cairvia:thread:complete": async (payload) =>
      kernel.threads.completeThread((payload as { id: string }).id),
    "cairvia:thread:captureRecovery": async (payload) =>
      kernel.threads.captureRecovery((payload as { id: string }).id),
    "cairvia:thread:getRecovery": async (payload) =>
      kernel.threads.getRecovery((payload as { id: string }).id),
    "cairvia:thread:markProgress": async (payload) => {
      const body = payload as { id: string; note: unknown };
      return kernel.threads.markProgress(
        body.id,
        ProgressNoteV1Schema.parse(body.note)
      );
    },
    "cairvia:action:execute": async (payload) => {
      const request = ActionRequestV1Schema.parse({
        ...(payload as object),
        schemaVersion: SCHEMA_VERSIONS.actionRequest,
        id: newActionId(),
        idempotencyKey: `idemp_${newActionId()}`
      });
      const permissions = await kernel.store.listPermissions();
      return runtime.execute(request, permissions);
    },
    "cairvia:preferences:get": async () => kernel.store.getPreferences(),
    "cairvia:preferences:update": async (payload) => {
      const prefs = UserPreferencesV1Schema.parse(payload);
      await kernel.store.savePreferences(prefs);
      return prefs;
    },
    "cairvia:permissions:list": async () => kernel.store.listPermissions(),
    "cairvia:status:get": async () => ({
      online: true,
      message: "Using the last saved Work Thread."
    }),
    "cairvia:events:list": async () => kernel.store.listEvents(50),
    "cairvia:recovery:card": async () => kernel.continuity.resumeCard(),
    "cairvia:snapshot:idle": async (payload) => {
      const id = (payload as { id?: string })?.id;
      const thread = id
        ? await kernel.threads.getThread(id)
        : await kernel.threads.getActiveThread();
      if (!thread) {
        return null;
      }
      return kernel.continuity.snapshotThread(thread, "app idle", ["idle"]);
    },
    "cairvia:commitments:pending": async () => kernel.store.listCommitments()
  });
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${LOCAL_API_ORIGIN}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Cairvia-Source": "ORB",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export function registerRemoteIpc(executors: OsExecutors): void {
  const runtime = createActionRegistry(executors);

  bindHandlers({
    "cairvia:thread:getActive": async () => {
      const data = await apiJson<{ thread: WorkThreadV1 | null }>("/threads/active");
      return data.thread;
    },
    "cairvia:thread:get": async (payload) => {
      const { id } = (payload as { id: string }) ?? {};
      const data = await apiJson<{ thread: WorkThreadV1 }>(`/threads/${id}`);
      return data.thread;
    },
    "cairvia:thread:list": async () => {
      const data = await apiJson<{ threads: WorkThreadV1[] }>("/threads");
      return data.threads;
    },
    "cairvia:thread:update": async (payload) => {
      const body = payload as { id: string; patch: unknown };
      const patch = ThreadUpdateV1Schema.parse(body.patch);
      const data = await apiJson<{ thread: WorkThreadV1 }>(`/threads/${body.id}`, {
        method: "PUT",
        body: JSON.stringify(patch)
      });
      return data.thread;
    },
    "cairvia:thread:pause": async (payload) => {
      const { id } = payload as { id: string };
      const data = await apiJson<{ thread: WorkThreadV1 }>(`/threads/${id}/pause`, {
        method: "POST",
        body: "{}"
      });
      return data.thread;
    },
    "cairvia:thread:resume": async (payload) => {
      const { id } = payload as { id: string };
      const data = await apiJson<{ thread: WorkThreadV1 }>(`/threads/${id}/resume`, {
        method: "POST",
        body: "{}"
      });
      return data.thread;
    },
    "cairvia:thread:complete": async (payload) => {
      const { id } = payload as { id: string };
      const data = await apiJson<{ thread: WorkThreadV1 }>(
        `/threads/${id}/complete`,
        { method: "POST", body: "{}" }
      );
      return data.thread;
    },
    "cairvia:thread:captureRecovery": async (payload) => {
      const { id } = payload as { id: string };
      const data = await apiJson<{ thread: WorkThreadV1 }>(
        `/threads/${id}/recovery`,
        { method: "POST", body: "{}" }
      );
      return data.thread;
    },
    "cairvia:thread:getRecovery": async (payload) => {
      const { id } = payload as { id: string };
      return apiJson(`/threads/${id}/recovery`);
    },
    "cairvia:thread:markProgress": async (payload) => {
      const body = payload as { id: string; note: unknown };
      const note = ProgressNoteV1Schema.parse(body.note);
      const data = await apiJson<{ thread: WorkThreadV1 }>(
        `/threads/${body.id}/progress`,
        { method: "POST", body: JSON.stringify(note) }
      );
      return data.thread;
    },
    "cairvia:action:execute": async (payload) => {
      const request = ActionRequestV1Schema.parse({
        ...(payload as object),
        schemaVersion: SCHEMA_VERSIONS.actionRequest,
        id: newActionId(),
        idempotencyKey: `idemp_${newActionId()}`
      });
      const { permissions } = await apiJson<{ permissions: ActionPermissionV1[] }>(
        "/permissions"
      );
      const result = await runtime.execute(request, permissions);
      await apiJson<{ result: ActionResultV1 }>("/actions", {
        method: "POST",
        body: JSON.stringify({
          toolId: request.toolId,
          threadId: request.threadId,
          input: request.input,
          idempotencyKey: request.idempotencyKey,
          confirmed: request.confirmed,
          recordOnly: true,
          status: result.status,
          message: result.message,
          verified: result.verified
        })
      });
      return result;
    },
    "cairvia:preferences:get": async () => {
      const data = await apiJson<{ preferences: unknown }>("/preferences");
      return data.preferences;
    },
    "cairvia:preferences:update": async (payload) => {
      const prefs = UserPreferencesV1Schema.parse(payload);
      const data = await apiJson<{ preferences: unknown }>("/preferences", {
        method: "PUT",
        body: JSON.stringify(prefs)
      });
      return data.preferences;
    },
    "cairvia:permissions:list": async () => {
      const data = await apiJson<{ permissions: unknown }>("/permissions");
      return data.permissions;
    },
    "cairvia:status:get": async () => {
      try {
        const data = await apiJson<{ mode: string; message: string }>("/status");
        return {
          online: data.mode !== "offline",
          message: data.message
        };
      } catch {
        return {
          online: false,
          message: "You're offline. Your last saved context is available."
        };
      }
    },
    "cairvia:events:list": async () => {
      const data = await apiJson<{ events: unknown[] }>("/events");
      return data.events;
    },
    "cairvia:recovery:card": async () => {
      const data = await apiJson<{ card: unknown }>("/recovery/card");
      return data.card;
    },
    "cairvia:snapshot:idle": async (payload) => {
      let id = (payload as { id?: string })?.id;
      if (!id) {
        const active = await apiJson<{ thread: WorkThreadV1 | null }>(
          "/threads/active"
        );
        id = active.thread?.id;
      }
      if (!id) {
        return null;
      }
      const data = await apiJson<{ snapshot: unknown }>(`/threads/${id}/snapshot`, {
        method: "POST",
        body: JSON.stringify({ reason: "app idle" })
      });
      return data.snapshot;
    },
    "cairvia:commitments:pending": async () => {
      const data = await apiJson<{ commitments: unknown[] }>("/commitments");
      return data.commitments;
    }
  });
}
