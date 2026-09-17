import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  nativeImage,
  screen
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTROL_CENTER_ORIGIN, GLOBAL_SHORTCUT } from "@cairvia/config";
import { createAppKernel } from "@cairvia/local-store";
import { startLocalApi } from "@cairvia/api";
import { createElectronExecutors } from "./executors.js";
import { registerIpc } from "./ipc.js";

const COLLAPSED = { width: 76, height: 76 };
const EXPANDED = { width: 400, height: 620 };

let orb: BrowserWindow | null = null;
let expanded = false;

function preloadPath(): string {
  return path.join(__dirname, "../preload/index.mjs");
}

function createOrb(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: COLLAPSED.width,
    height: COLLAPSED.height,
    x: workArea.x + workArea.width - COLLAPSED.width - 24,
    y: workArea.y + workArea.height - COLLAPSED.height - 24,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.setAlwaysOnTop(true, "screen-saver");

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  win.once("ready-to-show", () => win.show());
  return win;
}

function setExpanded(next: boolean): void {
  if (!orb) {
    return;
  }
  expanded = next;
  const { workArea } = screen.getPrimaryDisplay();
  const size = next ? EXPANDED : COLLAPSED;
  orb.setBounds({
    width: size.width,
    height: size.height,
    x: workArea.x + workArea.width - size.width - 24,
    y: workArea.y + workArea.height - size.height - 24
  });
  orb.webContents.send("cairvia:orb:layout", { expanded: next });
}

app.whenReady().then(async () => {
  const kernel = await createAppKernel();
  await startLocalApi(kernel);
  registerIpc(kernel, createElectronExecutors());
  orb = createOrb();

  globalShortcut.register(GLOBAL_SHORTCUT, () => {
    if (!orb) {
      return;
    }
    if (orb.isVisible()) {
      orb.hide();
    } else {
      orb.show();
      orb.focus();
    }
  });

  const { ipcMain } = await import("electron");
  ipcMain.on("cairvia:orb:expand", (_e, next: boolean) => setExpanded(next));
  ipcMain.on("cairvia:orb:open-control-center", () => {
    void import("electron").then(({ shell }) =>
      shell.openExternal(CONTROL_CENTER_ORIGIN)
    );
  });
  ipcMain.on("cairvia:orb:quit", () => app.quit());
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  app.quit();
});

Menu.setApplicationMenu(null);

void fileURLToPath;
