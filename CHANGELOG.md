# Changelog

All notable changes to stillworks. Versions follow [semver](https://semver.org/); every version is on [npm](https://www.npmjs.com/package/stillworks).

## Unreleased

### Added

- **Claude Code plugin:** `/plugin marketplace add valmirjunior2109-spec/stillworks`, then `/plugin install stillworks@stillworks`, adds the `/verify` command and the MCP server in one step ([integrations/claude-code-plugin](integrations/claude-code-plugin/README.md)). When releasing, bump the version in `integrations/claude-code-plugin/.claude-plugin/plugin.json` too (a unit test checks it).

### Changed

- The Publishub lines in the CLI, `REPORT.md` and the README now describe what the hosted version adds over the GitHub Action you can already run for free: hourly checks on your live app, alerts, journeys set up 1:1 by the founder and no terminal or CI needed. Same URLs and UTMs; still off with `--no-promo` or `NO_PUBLISHUB_PROMO=1`.
- The one Publishub line after `run` and `check` now depends on the result. When a journey or page failed, it says Publishub will run these journeys on every PR before deploy and links to the Founding Customers offer (`utm_source=gh_cli_fail`). When everything passed, it links to early access (`utm_source=gh_cli`). `REPORT.md` gets a matching footer (`gh_report_fail` / `gh_report`). Still one line, still off with `--no-promo` or `NO_PUBLISHUB_PROMO=1`.

## 0.1.7 (2026-11-24)

### Added

- **`npx stillworks mcp --http`: the MCP server over Streamable HTTP** (`POST /mcp`), for clients that connect to a URL. Stateless, one tool call at a time; `GET /health` for hosts. Listens on 127.0.0.1 by default and refuses requests from web pages that aren't on localhost.
- **`--hosted`: a public server for cloud builders** (Lovable, Bolt, Replit) and remote connectors (claude.ai, ChatGPT). `check_app` only, public URLs only: localhost, private networks, link-local and cloud metadata addresses are refused, and the browser is blocked from requesting them while it checks. Each check runs in a temporary folder deleted afterwards; screenshots of failed pages come back as MCP images. 20 checks per client per hour (`STILLWORKS_RATE_LIMIT`), optional bearer token (`STILLWORKS_MCP_TOKEN`), `--trust-proxy` for `X-Forwarded-For`.
- `Dockerfile` and `fly.toml` for the hosted server.
- [`integrations/README.md`](integrations/README.md): setup for Claude Code, Cursor (one-click link), VS Code, Windsurf, Codex, Claude Desktop, Gemini CLI, and the cloud builders.
- Tool annotations (`readOnlyHint` on `check_app`) and a `title` in `serverInfo`.

## 0.1.6 (2026-11-24)

### Added

- **Listed in the official MCP Registry** as `io.github.valmirjunior2109-spec/stillworks`: `mcpName` in `package.json` and `server.json`, and the release workflow now publishes `server.json` to the registry after npm. When releasing, bump the version in `package.json` and both versions in `server.json`. No changes to the CLI.

## 0.1.5 (2026-11-23)

### Added

- **`npx stillworks mcp`: an MCP server.** Claude Code, Cursor and other MCP clients get two tools, `check_app` (zero setup, read-only) and `run_journeys` (your journeys), and call them after a change. They return the same `REPORT.md`. Setup problems (app not running, no config) come back as tool errors the agent can act on.

## 0.1.4 (2026-11-23)

### Added

- **`npx stillworks check <url>`: a first look with zero setup.** No config file. It opens the URL and up to 6 pages linked from it (signup, login, pricing and dashboard first) in a real browser, and fails when a page doesn't load, shows a "not found" screen (including SPA 404s that answer 200), is blank, crashes with an uncaught JavaScript error or gets a 5xx from your app's API. It writes the same `REPORT.md` for your agent. Read-only: it never fills a form, clicks a button or opens links like "log out" or "delete".
- **`init` prints a prompt for your coding agent**, so it writes the journeys for you instead of you editing selectors by hand.
- Demo app: `--break=pages` (a link to a missing page, a JavaScript crash on `/notes` and a 500 from an API `/checkout` calls on load).
- README: `check` leads the quickstart, and a link to Publishub's free online check for people who build without a terminal.

## 0.1.3 (2026-11-21)

### Added

- **GitHub Action:** `uses: valmirjunior2109-spec/stillworks@v0.1.3` installs Chromium, runs your journeys against a URL (for example, a Vercel preview), fails the job when one breaks, adds `REPORT.md` to the run summary and uploads the screenshots. Outputs: `result` and `report`.
- **Recipes**, each tested against the demo app in CI: `read-the-data-back` (a form that says "Saved!" while nothing was saved, such as a Supabase insert blocked by row-level security) and `login-with-test-account`.
- Demo app: a notes page and `--break=save`.

### Fixed

- The action installs stillworks in its own folder instead of using `npx`, which resolved to the wrong package when the project itself is named stillworks.

## 0.1.2 (2026-11-21)

### Fixed

- A step that times out with no console errors and no failed requests is flagged as a likely selector problem, and the report tells the agent to check the screenshot before changing the app.
- A syntax error in `journeys.config.ts` reports the line, the column and the usual cause.
- `init` adds stillworks to your devDependencies with your package manager (npm, pnpm, yarn or bun) and installs Chromium with that copy, so the config gets types and the browser matches.
- New `env()` helper for test credentials, so the example config type-checks without `@types/node`.
- Windows: `init` prints the `npx.cmd` tip when PowerShell blocks `npx`.
- "Couldn't reach" errors say where the URL came from and how to pass another one.
- The untouched example journeys only run against a local URL, so a first try never submits forms on someone else's site.

### Added

- When every journey passes, `REPORT.md` suggests a static "tested with stillworks" README badge (off with `--no-promo`).

## 0.1.1 (2026-11-16)

- `init` ends with a short note about Publishub early access (off with `--no-promo` or `NO_PUBLISHUB_PROMO=1`).
- README: the early-access link moved up, under the demo.

## 0.1.0 (2026-11-11)

First release.

- `npx stillworks init` creates `journeys.config.ts` with editable signup, login and checkout journeys and installs Chromium.
- `npx stillworks run --url <url>` runs every journey in Chromium (Playwright), screenshots every step, and records console errors and failed requests with the server's response.
- `REPORT.md` is written as a prompt for your agent; `report.json` for scripts. Exit codes `0`, `1`, `2`.
- Integrations: Claude Code `/verify` command and Stop hook, a Cursor rule, an `AGENTS.md` snippet, a GitHub Actions workflow for Vercel previews.
- A demo app with a broken signup. No telemetry.
