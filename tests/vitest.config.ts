import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");

export default defineConfig({
  test: {
    environment: "node",
    include: ["integration/**/*.test.ts", "evaluation/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@cairvia/schemas": resolve(root, "packages/schemas/src/index.ts"),
      "@cairvia/domain": resolve(root, "packages/domain/src/index.ts"),
      "@cairvia/config": resolve(root, "packages/config/src/index.ts"),
      "@cairvia/local-store": resolve(root, "packages/local-store/src/index.ts"),
      "@cairvia/action-runtime": resolve(root, "packages/action-runtime/src/index.ts"),
      "@cairvia/api": resolve(root, "services/api/src/index.ts"),
      "@cairvia/policy": resolve(root, "packages/policy/src/index.ts")
    }
  }
});
