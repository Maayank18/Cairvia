# Cairvia Orb

```bash
pnpm install
node node_modules/electron/install.js   # if Electron binary is missing
npm run dev
```

`npm run dev` starts the shared local API, then the Orb. The Orb attaches to `http://127.0.0.1:47821` so Control Center and the extension see the same Work Thread.

- Left click the gold circle: open or close
- Drag the circle: move
- Right click the circle: Control Center / Quit
- **Ctrl+Shift+Space** / **Cmd+Shift+Space**: show or hide (works while the Orb is hidden)
- If that shortcut is taken (common in Cursor), **Ctrl+Alt+O** / **Cmd+Alt+O** is registered instead
- Tray icon: show/hide, open Control Center, quit
- Resume runs the stored LOW tool (`copy_to_clipboard`, `start_focus`, …)
- Stop captures a recovery capsule (ACTIVE → INTERRUPTED → RECOVERABLE)

Closing the Orb window hides it; it does not quit. Quit from the tray or the Orb menu.

Orb subscribes to `/v1/sync/stream`. Offline: last known thread is kept.

To run only the Orb (it will start the API if port 47821 is free):

```bash
pnpm dev:desktop
```

Production package: `pnpm --filter @cairvia/desktop build` (electron-vite). Packaging installers are not configured in this repo yet.
