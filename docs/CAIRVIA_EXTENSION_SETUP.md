# Cairvia Companion (Chrome and Edge MV3)

```bash
npm run build:extension
```

or just `npm run dev`, which rebuilds the folder first.

Load the unpacked directory **`dist/extension`**.

## Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Load unpacked → `dist/extension`
4. Pin Cairvia

## Microsoft Edge

1. Open `edge://extensions`
2. Enable Developer mode
3. Load unpacked → `dist/extension`
4. Pin Cairvia

## Use it

1. Keep `npm run dev` running so `:47821` is up
2. Select text on a page → right-click **Send selection to Cairvia**
3. Open the popup to Add or Ignore
4. Confirm the same Work Thread on the website and in the Orb

Reload the extension from the extensions page after `dist/extension` changes.

Permissions: `contextMenus`, `storage`, `activeTab`, host `http://127.0.0.1:47821/*`. No content script. No history collection.
