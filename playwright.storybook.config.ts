import { defineConfig, devices } from '@playwright/test';

/**
 * Runs axe on every story of the built component workspace in a real browser (catches colour contrast, which
 * jsdom cannot measure). `npm run test:storybook` builds the workspace first.
 */
// Outside the TCP ranges Windows/Hyper-V reserves on dev machines (6006 and 6007 often fall inside one).
const PORT = 6611;
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: './e2e-storybook',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) } }],
  webServer: {
    command: `npx vite preview --outDir storybook-static --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/index.json`,
    reuseExistingServer: !process.env.CI,
  },
});
