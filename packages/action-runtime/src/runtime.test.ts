import { describe, expect, it, vi } from "vitest";
import { defaultPermissions } from "@cairvia/domain";
import { SCHEMA_VERSIONS } from "@cairvia/schemas";
import { ActionDeniedError } from "./policy.js";
import { createActionRegistry } from "./registry.js";

const permissions = defaultPermissions("2026-09-17T10:00:00.000Z");

describe("action runtime", () => {
  it("copies text after policy check", async () => {
    const copyToClipboard = vi.fn(async () => undefined);
    const { execute } = createActionRegistry({
      openUrl: async () => undefined,
      openFile: async () => undefined,
      openApp: async () => undefined,
      copyToClipboard
    });
    const result = await execute(
      {
        schemaVersion: SCHEMA_VERSIONS.actionRequest,
        id: "act_1",
        toolId: "copy_to_clipboard",
        input: { text: "curl -s http://127.0.0.1:3000/health/mailer" },
        idempotencyKey: "idemp_1"
      },
      permissions
    );
    expect(copyToClipboard).toHaveBeenCalledOnce();
    expect(result.status).toBe("SUCCEEDED");
  });

  it("rejects HIGH tools", async () => {
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
          id: "act_2",
          toolId: "delete_data",
          input: {},
          idempotencyKey: "idemp_2"
        },
        permissions
      )
    ).rejects.toThrow(ActionDeniedError);
  });

  it("rejects non-http URLs", async () => {
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
          id: "act_3",
          toolId: "open_url",
          input: { url: "file:///etc/passwd" },
          idempotencyKey: "idemp_3"
        },
        permissions
      )
    ).rejects.toThrow();
  });
});
