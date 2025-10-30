import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for E2E testing
 * Uses separate test database for isolated testing
 */
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // webServer: {
//     command: 'NODE_ENV=test npm run start:test',
//     url: 'http://localhost:3000',
//     reuseExistingServer: !process.env.CI,
//     timeout: 120 * 1000,
// },
});