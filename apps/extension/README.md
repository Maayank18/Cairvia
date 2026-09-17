# Cairvia Companion

Build the unpacked folder, then load it in Chrome or Edge.

```bash
npm run build:extension
# or: pnpm build:extension
```

Load **`dist/extension`**, not `apps/extension`.

## Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Load unpacked → select `dist/extension`
4. Pin Cairvia

## Microsoft Edge

1. Open `edge://extensions`
2. Enable Developer mode
3. Load unpacked → select `dist/extension`
4. Pin Cairvia

## Test with the rest of Cairvia

Keep `npm run dev` running. Select text on a page → right-click **Send selection to Cairvia**. The popup shows the candidate and what was shared (title + selection) versus not shared (browsing history). The same Work Thread updates in the website and the Orb.

Reload the extension from the extensions page after rebuilding `dist/extension`.

Permissions: `contextMenus`, `storage`, `activeTab`, host `http://127.0.0.1:47821/*`. No content script. No history collection.
