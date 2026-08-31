import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'packages',
  testMatch: /test\/browser\/.+\.spec\.ts$/,
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 600, height: 800 },
    hasTouch: true,
  },
  webServer: {
    command: 'npx http-server . -p 4173 -a 127.0.0.1 --silent',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], hasTouch: true },
    },
  ],
});
