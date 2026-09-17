import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

const root = resolve(__dirname, "../..");

const aliases = {
  "@cairvia/ui/styles.css": resolve(root, "packages/ui/src/styles.css"),
  "@cairvia/schemas": resolve(root, "packages/schemas/src/index.ts"),
  "@cairvia/domain": resolve(root, "packages/domain/src/index.ts"),
  "@cairvia/config": resolve(root, "packages/config/src/index.ts"),
  "@cairvia/local-store": resolve(root, "packages/local-store/src/index.ts"),
  "@cairvia/action-runtime": resolve(root, "packages/action-runtime/src/index.ts"),
  "@cairvia/api": resolve(root, "services/api/src/index.ts"),
  "@cairvia/ui": resolve(root, "packages/ui/src/index.ts")
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@cairvia/api", "@cairvia/local-store", "@cairvia/domain", "@cairvia/schemas", "@cairvia/config", "@cairvia/action-runtime"] })],
    resolve: { alias: aliases }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: aliases }
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    plugins: [react()],
    resolve: { alias: aliases }
  }
});
