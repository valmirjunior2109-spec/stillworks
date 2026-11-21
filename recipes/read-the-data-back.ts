// Recipe: "it said Saved, but nothing was saved".
//
// The bug this catches: a form shows a success message while the write never happened. It's the most common
// silent failure in AI-built apps, for example with Supabase: supabase-js returns the error instead of throwing,
// so an insert blocked by row-level security (RLS) still shows the "Saved!" toast if the code never reads `error`.
// A screenshot or a 200 response won't catch it. Reading the data back will.
//
// Try it on the demo app:
//   node examples/demo-app/server.mjs --break=save
//   npx stillworks run --url http://127.0.0.1:4173 --config recipes/read-the-data-back.ts
//
// Adapt: change the page, the field label, the button name and where the saved item shows up in your app.
import { defineConfig } from "stillworks";

// A unique value every run, so you know the item on screen is the one this run created.
const note = `stillworks check ${Date.now()}`;

export default defineConfig({
  baseURL: "http://localhost:3000",
  journeys: [
    {
      name: "save-and-read-back",
      steps: [
        { name: "Open the notes page", run: ({ page }) => page.goto("/notes") },
        { name: "Write a note", run: ({ page }) => page.getByLabel("Note").fill(note) },
        { name: "Save it", run: ({ page }) => page.getByRole("button", { name: /save/i }).click() },
        { name: "See the success message", run: ({ page }) => page.getByText(/saved/i).first().waitFor() },
        // The step that matters: load the page again, so what you see comes from the database, not from the form.
        { name: "Reload the page", run: ({ page }) => page.reload() },
        { name: "See the note after reloading", run: ({ page }) => page.getByText(note).waitFor() },
      ],
    },
  ],
});
