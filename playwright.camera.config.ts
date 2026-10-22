import { defineConfig } from "@playwright/test";
export default defineConfig({
  workers: 1,
  outputDir: "camera-test-results",
  timeout: 60000,
  testDir: "./tests/camera",
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1100 },
  },
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "camera-chromium", use: { browserName: "chromium" } },
    {
      name: "camera-firefox-no-webgl",
      use: {
        browserName: "firefox",
        launchOptions: {
          firefoxUserPrefs: {
            "webgl.disabled": true,
            "media.navigator.permission.disabled": true,
          },
        },
      },
    },
    { name: "camera-webkit", use: { browserName: "webkit" } },
  ],
});
