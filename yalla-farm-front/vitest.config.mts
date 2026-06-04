import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  oxc: false,
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react"
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.integration.test.ts", "src/**/*.integration.test.tsx"],
    coverage: {
      reporter: ["text", "lcov"]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
