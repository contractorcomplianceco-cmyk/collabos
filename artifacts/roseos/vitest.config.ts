import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "../../attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
