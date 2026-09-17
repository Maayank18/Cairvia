# Troubleshooting

| Symptom | Fix |
| --- | --- |
| Control Center NOW empty | Run `npm run dev` so the API is up. Check `/recovery/card`. |
| Port 47821 or 5173 in use | Stop the other `dev` / API / Vite process, then start `npm run dev` again. |
| Orb does not toggle | Use **Ctrl+Shift+Space**. If Cursor owns it, use **Ctrl+Alt+O**, or the tray icon. |
| Orb is a blank dark square | Restart `npm run dev` after pulling Orb renderer fixes. Drag the gold circle; click it to open. |
| Orb stays after Ctrl+C | The overlay is Electron, not the website. Press Ctrl+C in the **dev** terminal. Next `npm run dev` also kills leftover Orb. Tray → Quit Cairvia. |
| Extension missing menu | Reload unpacked from `dist/extension` (not `apps/extension`). |
| Seed unchanged | Delete `.cairvia/cairvia.sqlite` then `pnpm seed`. |
| Electron missing | `node node_modules/electron/install.js` |
| Website not updating | Confirm SSE `GET /v1/sync/stream`; watch the sync indicator. |
| 409 on save | Another surface updated the thread; reload and retry. |
| Bedrock errors | Enable model access; or set `CAIRVIA_DETERMINISTIC_AGENT=1`. |
| `npm i` fails with `workspace:*` / EUNSUPPORTEDPROTOCOL | This repo is pnpm. Run `pnpm install`, never `npm i`. |
| npm prints shamefully-hoist / ERESOLVE for minutes | Stop it. npm cannot install this workspace. Use `pnpm install`. |
