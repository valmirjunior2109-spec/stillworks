// Recipe: log in with a test account, without writing its password in the file.
//
// Set the credentials as environment variables (locally, or as secrets in CI):
//   STILLWORKS_LOGIN_EMAIL=you+test@example.com STILLWORKS_LOGIN_PASSWORD=... npx stillworks run --config recipes/login-with-test-account.ts
// Use a dedicated test account, never a real customer's. Every journey starts with fresh cookies.
//
// Try it on the demo app (its test account is demo@example.com / demo-password, the defaults below):
//   node examples/demo-app/server.mjs
//   npx stillworks run --url http://127.0.0.1:4173 --config recipes/login-with-test-account.ts
import { defineConfig, env } from "stillworks";

const email = env("STILLWORKS_LOGIN_EMAIL", "demo@example.com");
const password = env("STILLWORKS_LOGIN_PASSWORD", "demo-password");

export default defineConfig({
  baseURL: "http://localhost:3000",
  journeys: [
    {
      name: "login",
      steps: [
        { name: "Open the login page", run: ({ page }) => page.goto("/login") },
        {
          name: "Fill in the test account",
          run: async ({ page }) => {
            await page.getByLabel("Email").fill(email);
            await page.getByLabel("Password").fill(password);
          },
        },
        { name: "Log in", run: ({ page }) => page.getByRole("button", { name: /log in|sign in/i }).click() },
        { name: "Land on the dashboard", run: ({ page }) => page.getByRole("heading", { name: /dashboard/i }).waitFor() },
      ],
    },
  ],
});
