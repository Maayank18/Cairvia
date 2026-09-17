import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
  type Rectangle
} from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTROL_CENTER_ORIGIN, GLOBAL_SHORTCUT, GLOBAL_SHORTCUT_FALLBACK } from "@cairvia/config";
import { createAppKernel } from "@cairvia/local-store";
import {
  isLocalApiHealthy,
  startLocalApi,
  waitForLocalApi
} from "@cairvia/api";
import { createElectronExecutors } from "./executors.js";
import { registerIpc, registerRemoteIpc } from "./ipc.js";

const COLLAPSED = { width: 72, height: 72 };
const EXPANDED = { width: 268, height: 312 };
const KEEP_VISIBLE = 56;

let orb: BrowserWindow | null = null;
let tray: Tray | null = null;
let expanded = false;
let isQuitting = false;
let userPlaced = false;
let toggleAccelerator = GLOBAL_SHORTCUT;
let dragOffset: { x: number; y: number } | null = null;

process.on("uncaughtException", (error) => {
  console.error("Cairvia Orb", error);
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  showOrb();
});

const here = path.dirname(fileURLToPath(import.meta.url));

function preloadPath(): string {
  const candidates = [
    path.join(here, "../preload/index.cjs"),
    path.join(here, "../preload/index.js"),
    path.join(here, "../preload/index.mjs")
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
}

function rendererPath(): string {
  return path.join(here, "../renderer/index.html");
}

function orbIconPath(): string {
  const candidates = [
    path.join(here, "../../resources/orb.png"),
    path.join(process.cwd(), "apps/desktop/resources/orb.png"),
    path.join(process.cwd(), "resources/orb.png")
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? "";
}

function humanShortcut(accelerator: string): string {
  const ctrl = process.platform === "darwin" ? "Cmd" : "Ctrl";
  return accelerator
    .replace("CommandOrControl", ctrl)
    .replaceAll("+", "+");
}

function workAreaFor(point: { x: number; y: number }): Rectangle {
  return screen.getDisplayNearestPoint(point).workArea;
}

function clampToWorkArea(
  x: number,
  y: number,
  width: number,
  height: number,
  fullyVisible: boolean
): { x: number; y: number } {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    const area = screen.getPrimaryDisplay().workArea;
    return {
      x: area.x + area.width - width - 40,
      y: area.y + Math.round(area.height * 0.62)
    };
  }
  const area = workAreaFor({ x: Math.round(x), y: Math.round(y) });
  const minX = fullyVisible ? area.x : area.x - width + KEEP_VISIBLE;
  const maxX = fullyVisible
    ? area.x + area.width - width
    : area.x + area.width - KEEP_VISIBLE;
  const minY = fullyVisible ? area.y : area.y - height + KEEP_VISIBLE;
  const maxY = fullyVisible
    ? area.y + area.height - height
    : area.y + area.height - KEEP_VISIBLE;
  return {
    x: Math.round(Math.min(Math.max(minX, x), maxX)),
    y: Math.round(Math.min(Math.max(minY, y), maxY))
  };
}

function sizeBounds(
  win: BrowserWindow,
  size: { width: number; height: number }
): Rectangle {
  const current = win.getBounds();
  const width = size.width;
  const height = size.height;
  let x: number;
  let y: number;
  if (userPlaced) {
    x = current.x + current.width - width;
    y = current.y + current.height - height;
  } else {
    const area = screen.getPrimaryDisplay().workArea;
    x = area.x + area.width - width - 40;
    y = area.y + Math.round(area.height * 0.62);
  }
  const clamped = clampToWorkArea(x, y, width, height, size === EXPANDED);
  return { ...clamped, width, height };
}

function applyOrbSize(win: BrowserWindow, size: { width: number; height: number }): void {
  const next = sizeBounds(win, size);
  win.setBounds(next);
}

function moveOrbWindow(win: BrowserWindow, x: number, y: number): void {
  const { width, height } = win.getBounds();
  const next = clampToWorkArea(x, y, width, height, expanded);
  win.setPosition(next.x, next.y);
}

function createOrb(): BrowserWindow {
  const iconFile = orbIconPath();
  const icon = iconFile ? nativeImage.createFromPath(iconFile) : undefined;
  const win = new BrowserWindow({
    width: COLLAPSED.width,
    height: COLLAPSED.height,
    frame: false,
    transparent: false,
    backgroundColor: "#161410",
    roundedCorners: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    focusable: true,
    hasShadow: true,
    icon,
    title: "Cairvia Orb",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  applyOrbSize(win, COLLAPSED);
  win.setAlwaysOnTop(true, "pop-up-menu");
  win.setIgnoreMouseEvents(false);
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error(`Cairvia Orb failed to load (${code}) ${desc} ${url}`);
  });
  win.webContents.on("render-process-gone", (_e, details) => {
    console.error("Cairvia Orb renderer gone", details);
  });
  win.webContents.on("console-message", (_e, level, message) => {
    if (level >= 2) {
      console.error("[orb]", message);
    }
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:")) {
      event.preventDefault();
    }
  });

  void win.loadFile(rendererPath());

  win.once("ready-to-show", () => {
    applyOrbSize(win, COLLAPSED);
    win.show();
    win.moveTop();
    win.setAlwaysOnTop(true, "pop-up-menu");
    win.setIgnoreMouseEvents(false);
  });
  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideOrb();
    }
  });
  return win;
}

function setExpanded(next: unknown): void {
  if (!orb) {
    return;
  }
  expanded = next === true;
  applyOrbSize(orb, expanded ? EXPANDED : COLLAPSED);
  orb.webContents.send("cairvia:orb:layout", { expanded });
}

function hideOrb(): void {
  if (!orb) {
    return;
  }
  orb.hide();
}

function quitOrb(): void {
  isQuitting = true;
  globalShortcut.unregisterAll();
  tray?.destroy();
  tray = null;
  if (orb) {
    orb.removeAllListeners("close");
    orb.destroy();
    orb = null;
  }
  app.quit();
}

function watchSharedApi(): void {
  if (process.env.CAIRVIA_EXTERNAL_API !== "1") {
    return;
  }
  let misses = 0;
  setInterval(() => {
    void isLocalApiHealthy().then((ok) => {
      if (ok) {
        misses = 0;
        return;
      }
      misses += 1;
      if (misses >= 3) {
        console.log("Cairvia Orb — local API stopped; quitting overlay.");
        quitOrb();
      }
    });
  }, 800);
}

function showOrb(): void {
  if (!orb) {
    return;
  }
  applyOrbSize(orb, expanded ? EXPANDED : COLLAPSED);
  orb.show();
  orb.moveTop();
  orb.focus();
}

function toggleOrb(): void {
  if (!orb) {
    return;
  }
  if (orb.isVisible()) {
    hideOrb();
  } else {
    showOrb();
  }
}

function createTray(): void {
  const iconFile = orbIconPath();
  const image = iconFile
    ? nativeImage.createFromPath(iconFile)
    : nativeImage.createEmpty();
  tray = new Tray(image.resize({ width: 16, height: 16 }));
  const shortcutLabel = humanShortcut(toggleAccelerator);
  tray.setToolTip(`Cairvia Orb — ${shortcutLabel || "tray click to show"}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show / Hide Orb",
        accelerator: toggleAccelerator || undefined,
        click: () => toggleOrb()
      },
      {
        label: "Open Control Center in browser",
        click: () => {
          void shell.openExternal(CONTROL_CENTER_ORIGIN);
        }
      },
      { type: "separator" },
      {
        label: "Quit Cairvia",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.on("click", () => toggleOrb());
}

function registerToggleShortcut(): void {
  if (globalShortcut.register(GLOBAL_SHORTCUT, () => toggleOrb())) {
    toggleAccelerator = GLOBAL_SHORTCUT;
    return;
  }
  if (globalShortcut.register(GLOBAL_SHORTCUT_FALLBACK, () => toggleOrb())) {
    toggleAccelerator = GLOBAL_SHORTCUT_FALLBACK;
    console.warn(
      `Cairvia: ${humanShortcut(GLOBAL_SHORTCUT)} is already used. Toggle the Orb with ${humanShortcut(GLOBAL_SHORTCUT_FALLBACK)}, or the tray icon.`
    );
    return;
  }
  toggleAccelerator = "";
  console.warn(
    "Cairvia: could not register a keyboard shortcut. Use the tray icon to show or hide the Orb."
  );
}

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.cairvia.orb");
  }
  app.setName("Cairvia Orb");
  const executors = createElectronExecutors();
  const preferExternal =
    process.env.CAIRVIA_EXTERNAL_API === "1" || (await isLocalApiHealthy());
  if (preferExternal) {
    const ready = await waitForLocalApi(
      process.env.CAIRVIA_EXTERNAL_API === "1" ? 20_000 : 1_000
    );
    if (ready) {
      registerRemoteIpc(executors);
    } else {
      const kernel = await createAppKernel();
      await startLocalApi(kernel);
      registerIpc(kernel, executors);
    }
  } else {
    const kernel = await createAppKernel();
    await startLocalApi(kernel);
    registerIpc(kernel, executors);
  }

  orb = createOrb();
  registerToggleShortcut();
  createTray();
  watchSharedApi();
  screen.on("display-metrics-changed", () => {
    if (orb) {
      applyOrbSize(orb, expanded ? EXPANDED : COLLAPSED);
    }
  });

  const { ipcMain } = await import("electron");
  ipcMain.on("cairvia:orb:expand", (_event, next) => {
    setExpanded(next === true);
  });
  ipcMain.on("cairvia:orb:drag-start", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? orb;
    if (!win) {
      return;
    }
    const cursor = screen.getCursorScreenPoint();
    const bounds = win.getBounds();
    dragOffset = { x: cursor.x - bounds.x, y: cursor.y - bounds.y };
  });
  ipcMain.on("cairvia:orb:drag-move", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? orb;
    if (!win || !dragOffset) {
      return;
    }
    userPlaced = true;
    const cursor = screen.getCursorScreenPoint();
    moveOrbWindow(win, cursor.x - dragOffset.x, cursor.y - dragOffset.y);
  });
  ipcMain.on("cairvia:orb:drag-end", () => {
    dragOffset = null;
  });
  ipcMain.on("cairvia:orb:open-control-center", () => {
    void shell.openExternal(CONTROL_CENTER_ORIGIN);
  });
  ipcMain.on("cairvia:orb:quit", () => {
    quitOrb();
  });
}).catch((error) => {
  console.error("Cairvia Orb failed to start", error);
});

app.on("before-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  tray?.destroy();
  tray = null;
});

app.on("window-all-closed", () => {
  if (isQuitting) {
    app.quit();
  }
});

Menu.setApplicationMenu(null);
