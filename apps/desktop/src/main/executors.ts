import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { clipboard, shell } from "electron";
import type { OsExecutors } from "@cairvia/action-runtime";

export function createElectronExecutors(): OsExecutors {
  return {
    async openUrl(url: string) {
      await shell.openExternal(url);
    },
    async openFile(filePath: string) {
      const error = await shell.openPath(filePath);
      if (error) {
        throw new Error(error);
      }
    },
    async openApp(appId) {
      const command =
        process.platform === "win32"
          ? { notepad: "notepad.exe", explorer: "explorer.exe", code: "code" }
          : { notepad: "gedit", explorer: "open", code: "code" };
      const bin = command[appId];
      const child = spawn(bin, [], {
        shell: false,
        detached: true,
        stdio: "ignore"
      });
      child.unref();
    },
    async copyToClipboard(text: string) {
      clipboard.writeText(text);
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
