import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import type { OsExecutors } from "./types.js";

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    child.on("error", reject);
    resolve();
  });
}

export function createNodeExecutors(): OsExecutors {
  return {
    async openUrl(url: string) {
      if (process.platform === "win32") {
        await run("cmd.exe", ["/c", "start", "", url]);
        return;
      }
      await run(process.platform === "darwin" ? "open" : "xdg-open", [url]);
    },
    async openFile(filePath: string) {
      if (process.platform === "win32") {
        await run("cmd.exe", ["/c", "start", "", filePath]);
        return;
      }
      await run(process.platform === "darwin" ? "open" : "xdg-open", [filePath]);
    },
    async openApp(appId) {
      const map: Record<typeof appId, [string, string[]]> = {
        notepad: process.platform === "win32" ? ["notepad.exe", []] : ["gedit", []],
        explorer:
          process.platform === "win32"
            ? ["explorer.exe", []]
            : ["open", ["."]],
        code: ["code", []]
      };
      const [cmd, args] = map[appId];
      await run(cmd, args);
    },
    async copyToClipboard(text: string) {
      if (process.platform === "win32") {
        await new Promise<void>((resolve, reject) => {
          const child = spawn(
            "powershell.exe",
            ["-NoProfile", "-Command", "[Console]::OpenStandardInput() | ForEach-Object { Set-Clipboard -Value ([string]$_) }"],
            { windowsHide: true }
          );
          child.stdin.write(text);
          child.stdin.end();
          child.on("error", reject);
          child.on("exit", (code) =>
            code === 0 ? resolve() : reject(new Error("clipboard failed"))
          );
        });
        return;
      }
      throw new Error("Clipboard copy from API is Windows-only in Phase 1; use the Orb");
    },
    async fileExists(filePath: string) {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    }
  };
}
