import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "@cairvia/schemas";

const ALLOWED = new Set<string>(IPC_CHANNELS);

contextBridge.exposeInMainWorld("cairvia", {
  invoke(channel: string, payload?: unknown) {
    if (!ALLOWED.has(channel)) {
      return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke("cairvia:invoke", channel, payload);
  },
  expand(next: boolean) {
    ipcRenderer.send("cairvia:orb:expand", next);
  },
  openControlCenter() {
    ipcRenderer.send("cairvia:orb:open-control-center");
  },
  quit() {
    ipcRenderer.send("cairvia:orb:quit");
  },
  onLayout(listener: (expanded: boolean) => void) {
    const wrapped = (_event: unknown, data: { expanded: boolean }) =>
      listener(data.expanded);
    ipcRenderer.on("cairvia:orb:layout", wrapped);
    return () => ipcRenderer.removeListener("cairvia:orb:layout", wrapped);
  }
});
