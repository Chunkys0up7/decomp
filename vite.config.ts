import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// SALT-21: one copy of React and Salt in the bundle, or the provider context is not seen.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "@salt-ds/core", "@salt-ds/styles", "@salt-ds/icons", "@salt-ds/window"],
  },
  build: { sourcemap: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
