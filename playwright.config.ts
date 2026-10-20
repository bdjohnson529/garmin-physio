import { defineConfig } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    command: `npx next dev --port ${port}`,
    url: `http://localhost:${port}/sign-in`,
    reuseExistingServer: !process.env.CI,
    env: {
      // Placeholders let the app boot. Signed-out pages never reach Supabase.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "placeholder-publishable-key",
    },
  },
});
