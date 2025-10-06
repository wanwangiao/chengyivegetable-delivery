import type { PlaywrightTestConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

const config: PlaywrightTestConfig = {
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : {
        command: 'pnpm next start --hostname 0.0.0.0 --port 3001',
        cwd: __dirname,
        port: 3001,
        reuseExistingServer: !process.env.CI
      }
};

export default config;
