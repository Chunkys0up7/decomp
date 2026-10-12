import { defineConfig } from "@playwright/test";

// Appendix D. Both projects run the same specs: dev server and the production build (spec 4.9 item 8).
const density = process.env.APP_DENSITY ?? "low";
const env = `cross-env VITE_APP_DENSITY=${density}`;

export default defineConfig({
  testDir: "e2e",
  retries: process.env.CI ? 1 : 0,
  use: { viewport: { width: 1440, height: 900 } },
  projects: [
    { name: "dev", use: { baseURL: "http://localhost:5173" } },
    { name: "preview", use: { baseURL: "http://localhost:4173" } },
  ],
  webServer: [
    { command: `${env} npm run dev -- --port 5173 --strictPort`, url: "http://localhost:5173", reuseExistingServer: !process.env.CI },
    {
      command: `${env} VITE_SALT_CHECK=1 npm run build && npm run preview -- --port 4173 --strictPort`,
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
