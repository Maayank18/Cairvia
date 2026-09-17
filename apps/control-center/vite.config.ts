import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = resolve(__dirname, "../..");

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  },
  resolve: {
    alias: {
      "@cairvia/ui/styles.css": resolve(root, "packages/ui/src/styles.css"),
      "@cairvia/schemas": resolve(root, "packages/schemas/src/index.ts"),
      "@cairvia/domain/interaction-mode": resolve(
        root,
        "packages/domain/src/interaction-mode.ts"
      ),
      "@cairvia/domain": resolve(root, "packages/domain/src/index.ts"),
      "@cairvia/config/constants": resolve(
        root,
        "packages/config/src/constants.ts"
      ),
      "@cairvia/config": resolve(root, "packages/config/src/index.ts"),
      "@cairvia/ui": resolve(root, "packages/ui/src/index.ts")
    }
  }
});
