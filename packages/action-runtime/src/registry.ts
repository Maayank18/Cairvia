import { randomUUID } from "node:crypto";
import type { z } from "zod";
import {
  SCHEMA_VERSIONS,
  type ActionPermissionV1,
  type ActionRequestV1,
  type ActionResultV1
} from "@cairvia/schemas";
import { authorize } from "./policy.js";
import {
  CopyInput,
  OpenAppInput,
  OpenFileInput,
  OpenUrlInput,
  StartFocusInput,
  type ActionDefinition,
  type OsExecutors
} from "./types.js";

function iso(): string {
  return new Date().toISOString();
}

export function createActionRegistry(executors: OsExecutors) {
  const open_url: ActionDefinition<z.infer<typeof OpenUrlInput>> = {
    id: "open_url",
    risk: "LOW",
    description: "Open an http(s) URL in the default browser",
    requiredPermission: "open_url",
    inputSchema: OpenUrlInput,
    async execute(input) {
      const parsed = OpenUrlInput.parse(input);
      const protocol = new URL(parsed.url).protocol;
      if (protocol !== "http:" && protocol !== "https:") {
        throw new Error("Only http(s) URLs are allowed");
      }
      await executors.openUrl(parsed.url);
      return { message: `Opened ${parsed.url}` };
    },
    async verify(input) {
      return OpenUrlInput.safeParse(input).success;
    }
  };

  const open_file: ActionDefinition<z.infer<typeof OpenFileInput>> = {
    id: "open_file",
    risk: "LOW",
    description: "Open a local file or folder path",
    requiredPermission: "open_file",
    inputSchema: OpenFileInput,
    async execute(input) {
      const parsed = OpenFileInput.parse(input);
      if (executors.fileExists) {
        const exists = await executors.fileExists(parsed.path);
        if (!exists) {
          throw new Error("File does not exist");
        }
      }
      await executors.openFile(parsed.path);
      return { message: `Opened ${parsed.path}` };
    },
    async verify(input) {
      if (!OpenFileInput.safeParse(input).success) {
        return false;
      }
      if (executors.fileExists) {
        return executors.fileExists(input.path);
      }
      return true;
    }
  };

  const open_app: ActionDefinition<z.infer<typeof OpenAppInput>> = {
    id: "open_app",
    risk: "LOW",
    description: "Open an allowlisted local application",
    requiredPermission: "open_app",
    inputSchema: OpenAppInput,
    async execute(input) {
      const parsed = OpenAppInput.parse(input);
      await executors.openApp(parsed.appId);
      return { message: `Opened ${parsed.appId}` };
    },
    async verify(input) {
      return OpenAppInput.safeParse(input).success;
    }
  };

  const copy_to_clipboard: ActionDefinition<z.infer<typeof CopyInput>> = {
    id: "copy_to_clipboard",
    risk: "LOW",
    description: "Copy prepared text to the clipboard",
    requiredPermission: "copy_to_clipboard",
    inputSchema: CopyInput,
    async execute(input) {
      const parsed = CopyInput.parse(input);
      await executors.copyToClipboard(parsed.text);
      return { message: "Copied next action to clipboard" };
    },
    async verify(input) {
      return CopyInput.safeParse(input).success;
    }
  };

  const start_focus: ActionDefinition<z.infer<typeof StartFocusInput>> = {
    id: "start_focus",
    risk: "LOW",
    description: "Start a local focus session on the current thread",
    requiredPermission: "start_focus",
    inputSchema: StartFocusInput,
    async execute(input) {
      const parsed = StartFocusInput.parse(input);
      return { message: `Focus started for ${parsed.threadId}` };
    },
    async verify(input) {
      return StartFocusInput.safeParse(input).success;
    }
  };

  const registry = {
    open_url,
    open_file,
    open_app,
    copy_to_clipboard,
    start_focus
  } as const;

  async function execute(
    request: ActionRequestV1,
    permissions: ActionPermissionV1[]
  ): Promise<ActionResultV1> {
    authorize(permissions, request.toolId);
    const tool = registry[request.toolId as keyof typeof registry];
    if (!tool) {
      throw new Error(`Unknown tool: ${request.toolId}`);
    }
    const parsedInput = tool.inputSchema.parse(request.input);
    const result = await tool.execute(parsedInput as never);
    const verified = await tool.verify(parsedInput as never);
    return {
      schemaVersion: SCHEMA_VERSIONS.actionResult,
      actionId: request.id,
      status: verified ? "SUCCEEDED" : "FAILED",
      message: result.message,
      verified,
      at: iso()
    };
  }

  return { registry, execute };
}

export function newActionId(): string {
  return `act_${randomUUID()}`;
}
