import { ipcMain, type IpcMainInvokeEvent } from "electron";
import {
  ActionRequestV1Schema,
  IPC_CHANNELS,
  ProgressNoteV1Schema,
  SCHEMA_VERSIONS,
  ThreadUpdateV1Schema,
  UserPreferencesV1Schema,
  type IpcChannel
} from "@cairvia/schemas";
import {
  createActionRegistry,
  newActionId,
  type OsExecutors
} from "@cairvia/action-runtime";
import type { AppKernel } from "@cairvia/api";

const ALLOWED = new Set<string>(IPC_CHANNELS);

export function registerIpc(kernel: AppKernel, executors: OsExecutors): void {
  const runtime = createActionRegistry(executors);

  const handlers: Record<IpcChannel, (payload: unknown) => Promise<unknown>> = {
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
      message: "Using local Work Thread."
    }),
    "cairvia:events:list": async () => kernel.store.listEvents(50)
  };

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
