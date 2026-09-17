import { z } from "zod";
import type { ActionRisk, ToolId } from "@cairvia/schemas";

export const OpenUrlInput = z.object({
  url: z.string().url()
});
export const OpenFileInput = z.object({
  path: z.string().min(1)
});
export const OpenAppInput = z.object({
  appId: z.enum(["notepad", "explorer", "code"])
});
export const CopyInput = z.object({
  text: z.string().min(1)
});
export const StartFocusInput = z.object({
  threadId: z.string().min(1)
});

export interface ActionDefinition<TInput> {
  id: ToolId;
  risk: ActionRisk;
  description: string;
  requiredPermission: ToolId;
  inputSchema: z.ZodType<TInput>;
  execute: (input: TInput) => Promise<{ message: string }>;
  verify: (input: TInput) => Promise<boolean>;
}

export interface OsExecutors {
  openUrl: (url: string) => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  openApp: (appId: "notepad" | "explorer" | "code") => Promise<void>;
  copyToClipboard: (text: string) => Promise<void>;
  fileExists?: (filePath: string) => Promise<boolean>;
}

export const ALLOWED_APPS = ["notepad", "explorer", "code"] as const;
