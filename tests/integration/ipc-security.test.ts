import { describe, expect, it } from "vitest";
import { IPC_CHANNELS } from "@cairvia/schemas";
import { defaultPermissions } from "@cairvia/domain";
import { ActionDeniedError, createActionRegistry } from "@cairvia/action-runtime";
import { SCHEMA_VERSIONS } from "@cairvia/schemas";

const ALLOWED = new Set<string>(IPC_CHANNELS);

async function secureInvoke(
  channel: string,
  payload: unknown,
  handlers: Record<string, (payload: unknown) => Promise<unknown>>
) {
  if (!ALLOWED.has(channel)) {
    throw new Error(`Blocked IPC channel: ${channel}`);
  }
  return handlers[channel]!(payload);
}

describe("renderer → preload → action runtime", () => {
  it("blocks unknown channels", async () => {
    await expect(
      secureInvoke("cairvia:shell:exec", { cmd: "rm -rf /" }, {})
    ).rejects.toThrow(/Blocked IPC/);
  });

  it("runs allowlisted copy through the registry", async () => {
    const copied: string[] = [];
    const { execute } = createActionRegistry({
      openUrl: async () => undefined,
      openFile: async () => undefined,
      openApp: async () => undefined,
      copyToClipboard: async (text) => {
        copied.push(text);
      }
    });
    const handlers = {
      "cairvia:action:execute": (payload: unknown) =>
        execute(
          {
            schemaVersion: SCHEMA_VERSIONS.actionRequest,
            id: "act_test",
            ...(payload as object),
            idempotencyKey: "idemp_test"
          } as never,
          defaultPermissions(new Date().toISOString())
        )
    };
    await secureInvoke(
      "cairvia:action:execute",
      { toolId: "copy_to_clipboard", input: { text: "next" } },
      handlers
    );
    expect(copied).toEqual(["next"]);
  });

  it("does not execute HIGH tools", async () => {
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
  });
});
