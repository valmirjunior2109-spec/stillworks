---
title: Your AI agent says "done". Here's how I check it actually works.
published: false
description: Tests pass, signup is broken. A small open-source CLI that runs your critical user journeys in a real browser after every AI change.
tags: ai, testing, playwright, opensource
cover_image: https://raw.githubusercontent.com/valmirjunior2109-spec/stillworks/main/assets/social-preview.png
canonical_url:
---

<!-- Publish on dev.to (and copy to Hashnode/Medium with canonical_url pointing to the dev.to post). -->

Here's a bug every automated check misses, and it's exactly the kind AI agents ship.

Picture a small refactor in a signup API. The agent renames a field: the handler now reads `emailAddress`, while the form still sends `email`. TypeScript is happy, because the request body is `any` at that boundary. Lint passes. Unit tests pass, because they call the handler with the new field name. The agent says "done".

In the browser, the Create account button does nothing. No error on screen, a 500 in the network tab, and a `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` in the server logs.

## The gap

Unit tests check functions. Type checks check shapes. Nothing in that loop checks the thing users actually do: open the page, fill the form, click, and see the next screen.

End-to-end tests do, but most small teams don't have them. The ones that exist usually run in CI, after the agent is long done and you've moved on.

What I wanted was simple:

1. A short list of critical journeys: signup, login, checkout.
2. Run them in a real browser right after the agent finishes.
3. When one breaks, hand the agent everything it needs to fix it.

## stillworks

So I built [stillworks](https://github.com/valmirjunior2109-spec/stillworks), an open-source CLI on top of Playwright.

```sh
npx stillworks init                              # writes journeys.config.ts, installs Chromium
npx stillworks run --url http://localhost:3000
```

A journey is a list of named steps in plain Playwright:

```ts
{
  name: "signup",
  steps: [
    { name: "Open the signup page", run: ({ page }) => page.goto("/signup") },
    { name: "Fill in email and password", run: async ({ page }) => {
        await page.getByLabel("Email").fill(`test+${Date.now()}@example.com`);
        await page.getByLabel("Password").fill("correct-horse-battery-staple");
    } },
    { name: "Submit the form", run: ({ page }) => page.getByRole("button", { name: "Create account" }).click() },
    { name: "See the welcome screen", run: ({ page }) => page.getByText("Welcome").waitFor() },
  ],
}
```

Each step gets a screenshot. Console errors and failed requests are recorded along the way, including the start of the response body for your own API. If a journey fails, the process exits with code 1.

## The report is a prompt

The part that made the biggest difference is the output format. `verify-report/REPORT.md` isn't a test log. It's written to be pasted into the agent:

```
## The `signup` journey failed at step 4 of 4: "See the welcome screen"

Failed requests:
- POST /api/signup → 500 Internal Server Error
  Response: `{"error":"TypeError: Cannot read properties of undefined (reading 'toLowerCase')"}`

Screenshot: verify-report/screenshots/signup-04-see-the-welcome-screen.png

Fix this without changing unrelated files. Find the root cause (start from the failed
requests and console errors above); don't change the journey or weaken the check to make
it pass. These journeys still pass, keep them passing: `login`, `checkout`.
```

The failed request and the server's error message point straight at the renamed field. Compare that with telling the agent "signup is broken" and getting back "I've added more error handling to the signup form".

## Closing the loop in Claude Code

Pasting is fine. Not having to remember is better. stillworks has a Claude Code Stop hook: when Claude finishes a response, the journeys run. If one fails, the hook exits with code 2 and Claude Code feeds the report back to the agent, which keeps working until everything passes.

Three details keep it from getting annoying:

- It skips turns where no file changed (it fingerprints `git diff` and new files), so chat-only turns cost nothing.
- It never blocks when the app isn't running or the config is broken.
- It respects `stop_hook_active`, so it can't loop forever.

There's also a `/verify` slash command, a Cursor rule, an AGENTS.md snippet for Codex and Copilot, and a GitHub Action that runs the journeys against Vercel preview deploys.

## Try it in 30 seconds

The repo ships a demo app with exactly the bug above:

```sh
git clone https://github.com/valmirjunior2109-spec/stillworks && cd stillworks
npm install && npm run build && node dist/cli.js install
npm run demo:broken      # in one terminal
node dist/cli.js run --url http://127.0.0.1:4173 --config templates/journeys.config.ts
```

It's MIT, has no telemetry, and runs on macOS, Linux and Windows.

I'm also building [Publishub](https://getpublishub.com/?utm_source=devto), a hosted version that runs your journeys on every PR and compares each run with your last working version. It isn't out yet. The CLI stays free.

What would you want checked first in your app?
