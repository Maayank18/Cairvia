# Local development

Node.js 22+, pnpm 10+. No Docker, no Python. Install with `pnpm install` only — `npm i` cannot resolve `workspace:*`.

```bash
pnpm install
pnpm test
pnpm seed
npm run dev
```

`npm run dev` and `pnpm dev` both start:

1. Local API at http://127.0.0.1:47821 (shared Work Thread kernel)
2. Control Center at http://127.0.0.1:5173
3. Cairvia Orb (Electron). **Ctrl+Shift+Space** shows or hides it. Tray icon does the same.
4. Unpacked extension at `dist/extension`

The Orb attaches to the API instead of starting a second kernel, so website, Orb, and extension share one Work Thread.

Load the extension: Chrome `chrome://extensions` or Edge `edge://extensions` → Developer mode → Load unpacked → `dist/extension`.

Ctrl+C in the `dev` terminal stops API, website, and Orb.

SQLite: `%USERPROFILE%\.cairvia\cairvia.sqlite` or `~/.cairvia`.
