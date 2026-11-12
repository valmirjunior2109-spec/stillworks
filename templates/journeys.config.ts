import { defineConfig } from "stillworks";

// Journeys are the flows your app can't live without. Each step is plain Playwright:
// https://playwright.dev/docs/locators. Rename things, delete what you don't have, add your own.
// Run them with: npx stillworks run --url http://localhost:3000

// A fresh address every run, so signup never hits "email already taken".
const newUser = { email: `stillworks+${Date.now()}@example.com`, password: "correct-horse-battery-staple" };

// An account that already exists in the app you check (use a test account, never a real one).
const existingUser = {
  email: process.env.STILLWORKS_LOGIN_EMAIL ?? "demo@example.com",
  password: process.env.STILLWORKS_LOGIN_PASSWORD ?? "demo-password",
};

export default defineConfig({
  baseURL: "http://localhost:3000", // --url overrides this
  timeout: 10_000, // per action, in ms

  journeys: [
    {
      name: "signup",
      steps: [
        { name: "Open the signup page", run: ({ page }) => page.goto("/signup") },
        {
          name: "Fill in email and password",
          run: async ({ page }) => {
            await page.getByLabel("Email").fill(newUser.email);
            await page.getByLabel("Password").fill(newUser.password);
          },
        },
        { name: "Submit the form", run: ({ page }) => page.getByRole("button", { name: /create account|sign up/i }).click() },
        { name: "See the welcome screen", run: ({ page }) => page.getByText(/welcome/i).first().waitFor() },
      ],
    },
    {
      name: "login",
      steps: [
        { name: "Open the login page", run: ({ page }) => page.goto("/login") },
        {
          name: "Fill in the test account",
          run: async ({ page }) => {
            await page.getByLabel("Email").fill(existingUser.email);
            await page.getByLabel("Password").fill(existingUser.password);
          },
        },
        { name: "Log in", run: ({ page }) => page.getByRole("button", { name: /log in|sign in/i }).click() },
        { name: "Land on the dashboard", run: ({ page }) => page.getByRole("heading", { name: /dashboard/i }).waitFor() },
      ],
    },
    {
      name: "checkout",
      // Point this at a test-mode checkout. If you use Stripe Checkout, the card form lives on stripe.com:
      // stop at "Reach the payment page", or use page.frameLocator() for embedded Stripe Elements.
      steps: [
        { name: "Open the pricing page", run: ({ page }) => page.goto("/checkout") },
        { name: "Fill in a test card", run: ({ page }) => page.getByLabel("Card number").fill("4242 4242 4242 4242") },
        { name: "Pay", run: ({ page }) => page.getByRole("button", { name: /pay|buy|subscribe/i }).click() },
        { name: "See the confirmation", run: ({ page }) => page.getByText(/payment successful|thank you/i).first().waitFor() },
      ],
    },
  ],
});
