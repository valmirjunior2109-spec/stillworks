# Peerlist (Launchpad / Projects)

**Name:** stillworks

**Tagline:** Your AI writes the code. This checks it still works.

**Links**
- GitHub: https://github.com/valmirjunior2109-spec/stillworks
- npm: https://www.npmjs.com/package/stillworks
- Website: https://getpublishub.com/?utm_source=peerlist

**Categories:** Developer Tools · Open Source · AI · Testing

**Built with:** TypeScript, Node.js, Playwright

**Description**

AI coding agents like Claude Code, Cursor and Codex write code fast. The code compiles, lint passes, tests pass, and signup is still broken, often in a file the agent wasn't supposed to touch.

stillworks is a free, open-source CLI that runs your critical user journeys (signup, login, checkout) in a real browser:

- `npx stillworks init` creates editable example journeys and installs Chromium
- `npx stillworks run --url http://localhost:3000` runs every journey, screenshots each step, and captures console errors and failed requests
- When something breaks, it writes `REPORT.md` as a prompt your agent can act on: the step that failed, the server's response, the screenshot, and "fix this without changing unrelated files"

It ships with a `/verify` command and a Stop hook for Claude Code, a Cursor rule, an AGENTS.md snippet for Codex and Copilot, and a GitHub Action for Vercel preview deploys. MIT licensed, no telemetry, works on macOS, Linux and Windows.

It's made by the team building Publishub, which will run these checks automatically on every change, with regression diffs (coming soon, early access open).

**First comment (post it yourself after launching)**

Hey Peerlist 👋 I built this after shipping one too many "all tests green" commits that broke signup. Try it on the demo app in the repo: `npm run demo:broken`, then run the journeys and watch it catch the bug. What flow should I add a template for next?
