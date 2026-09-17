# Cairvia

Keep the thread. Continue the work.

Cairvia is a local-first Work Thread system. Phase 1 is the product kernel: Electron Orb, Control Center, SQLite persistence, recovery capsules, and safe local actions. There is no agent intelligence yet.

Read `01_PROJECT_SPEC_CAIRVIA.md` before changing behavior.

## Requirements

- Node.js 22+
- pnpm 10+
- Windows, macOS, or Linux

## Fresh install

```bash
pnpm install
pnpm test
pnpm seed
```

Local data lives at `%USERPROFILE%\.cairvia\cairvia.sqlite` (or `~/.cairvia` on macOS/Linux). Persistence is SQLite via Drizzle, using the SQL.js engine so Phase 1 does not require native compiler toolchains.

## Run Phase 1

Terminal 1 — local API (needed for Control Center; also started by the Orb):

```bash
pnpm dev:api
```

Terminal 2 — Control Center:

```bash
pnpm dev:control-center
```

Open http://127.0.0.1:5173

Terminal 3 — Orb:

```bash
pnpm dev:desktop
```

If `pnpm dev:desktop` fails because Electron's install script was skipped, run:

```bash
node node_modules/electron/install.js
pnpm dev:desktop
```

## How to use the vertical slice

Seeded thread: **Fix authentication** / OTP registration / next action **Run mailer health check**.

Orb

- Left click: compact panel
- Right click: action menu
- Global shortcut: `Ctrl+Shift+Space` (or `Cmd+Shift+Space`) toggles the Orb

From the panel: Resume (starts focus + copies the health-check command), Mark progress, Stop (pauses and captures a recovery capsule), Capture.

Control Center screens: NOW, THREAD, AUTOMATIONS (empty), CONTROL (permissions and working preferences).

## Offline

Disconnect the network. The Orb still opens from SQLite and shows:

`Offline — using local Work Thread.`

Close Electron and reopen it. The same Work Thread is still there. Mutations are written to a local `sync_queue` for later cloud reconcile.

## Security

- `contextIsolation: true`, `nodeIntegration: false`, sandboxed renderer
- Allowlisted IPC channels only
- No renderer filesystem or shell access
- Actions go UI → preload → action runtime → policy → execute → audit
- Phase 1 executes LOW tools only: `open_url`, `open_file`, `open_app`, `copy_to_clipboard`, `start_focus`

## Tests

```bash
pnpm test
```

Covers domain transitions, Zod schemas, recovery capsules, permission evaluation, stale detection, SQLite read/write, thread lifecycle, offline queue, and IPC allowlisting.

## Phase 1 exit gate

- [x] Electron Orb
- [x] Control Center (four screens)
- [x] WorkThread as the primary domain model
- [x] SQLite + Drizzle schema with migrations
- [x] Recovery capsule capture (immutable)
- [x] Safe local actions
- [x] Keyboard accessible UI / visible focus / reduced-motion CSS
- [x] Offline local thread
- [x] Secured IPC
- [x] Unit and integration tests
- [x] Fresh install documented here

Do not start Phase 2 until this loop is reliable.
