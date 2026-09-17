import { cpSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeCairviaIcons } from "./write-icons.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "apps/extension");
const out = path.join(root, "dist/extension");

writeCairviaIcons();

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const files = [
  "manifest.json",
  "background.js",
  "popup.html",
  "popup.js",
  "popup.css"
];

for (const file of files) {
  cpSync(path.join(source, file), path.join(out, file));
}
cpSync(path.join(source, "icons"), path.join(out, "icons"), { recursive: true });

writeFileSync(
  path.join(out, "LOAD_IN_CHROME_AND_EDGE.md"),
  `# Load Cairvia Companion

This folder is the unpacked Chrome / Edge extension. Use this directory, not the repo root.

## Chrome

1. Open chrome://extensions
2. Turn on Developer mode
3. Click Load unpacked
4. Select this folder: dist/extension
5. Pin Cairvia from the puzzle-piece menu

## Microsoft Edge

1. Open edge://extensions
2. Turn on Developer mode
3. Click Load unpacked
4. Select this folder: dist/extension
5. Pin Cairvia from the extensions menu

## Test

1. Keep \`npm run dev\` (or \`pnpm dev\`) running so http://127.0.0.1:47821 is up
2. Open any page, select text, right-click → Send selection to Cairvia
3. Open the Cairvia popup to Add or Ignore the candidate
4. Confirm the same Work Thread updates in the website (http://127.0.0.1:5173) and the Orb

Reload the extension from the extensions page after you rebuild this folder.
`
);

console.log(`Cairvia extension unpacked at ${out}`);
console.log("Chrome: chrome://extensions → Load unpacked → dist/extension");
console.log("Edge:   edge://extensions → Load unpacked → dist/extension");
