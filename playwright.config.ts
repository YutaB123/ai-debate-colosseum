import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DEBATE_USE_STUB_PROVIDERS: "true",
      DEBATE_DB_PATH: "./data/e2e.db",
      OPENAI_API_KEY: "stub",
      ANTHROPIC_API_KEY: "stub",
      DEEPSEEK_API_KEY: "stub",
      GOOGLE_API_KEY: "stub",
    },
  },
  use: {
    baseURL: "http://localhost:3000",
  },
});
