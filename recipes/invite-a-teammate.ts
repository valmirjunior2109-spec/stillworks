// Recipe: invite a teammate and see them in the member list.
//
// The bug this catches: the invite form says "Invite sent" while no invite was stored. It's the same silent failure
// as read-the-data-back, on a flow agents often break when they touch auth or roles: a new permission check or
// row-level security (RLS) policy filters the insert away, the API still answers 200, and the success message shows.
// Reloading the member list and looking for the pending invite will catch it.
//
// It logs in first with the steps from login-with-test-account.ts, so set the same environment variables
// (STILLWORKS_LOGIN_EMAIL, STILLWORKS_LOGIN_PASSWORD) and keep both files together.
//
// Try it on the demo app:
//   node examples/demo-app/server.mjs --break=invite
//   npx stillworks run --url http://127.0.0.1:4173 --config recipes/invite-a-teammate.ts
//
// Adapt: change the team page's path, the field label, the button name and how a pending invite shows up in your list.
// Use an address nobody reads (example.com never receives mail), so a real person never gets the invite.
import { defineConfig } from "stillworks";
import login from "./login-with-test-account";

// A unique address every run, so you know the invite on screen is the one this run sent.
const invitee = `test+${Date.now()}@example.com`;

export default defineConfig({
  baseURL: "http://localhost:3000",
  journeys: [
    {
      name: "invite-a-teammate",
      steps: [
        ...login.journeys.find((journey) => journey.name === "login")!.steps,
        { name: "Open the team page", run: ({ page }) => page.goto("/team") },
        { name: "Enter the teammate's email", run: ({ page }) => page.getByLabel("Email").fill(invitee) },
        { name: "Send the invite", run: ({ page }) => page.getByRole("button", { name: /invite/i }).click() },
        { name: "See the invite sent message", run: ({ page }) => page.getByText(/invite sent/i).first().waitFor() },
        // The step that matters: load the page again, so the list comes from the database, not from the form.
        { name: "Reload the page", run: ({ page }) => page.reload() },
        {
          name: "See the pending invite after reloading",
          run: ({ page }) => page.getByRole("listitem").filter({ hasText: invitee }).filter({ hasText: /pending|invited/i }).waitFor(),
        },
      ],
    },
  ],
});
