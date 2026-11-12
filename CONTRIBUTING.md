# Contributing to stillworks

Thanks for helping. Small, focused pull requests get merged fastest.

## Setup

```sh
git clone https://github.com/valmirjunior2109-spec/stillworks && cd stillworks
npm install
npm run build
node dist/cli.js install     # Chromium for Playwright, one time
npm test                     # unit tests + end-to-end tests against examples/demo-app
```

Node.js 20 or newer. The tests start the demo app themselves; you don't need anything else running.

## Layout

| Path | What's there |
| --- | --- |
| `src/cli.ts` | Commands, terminal output, the Claude Code hook |
| `src/runner.ts` | Runs journeys with Playwright, collects console errors, failed requests and screenshots |
| `src/report.ts` | Writes `REPORT.md` (a prompt for the agent) and `report.json` |
| `src/config.ts` | Config types, `defineConfig`, loading `journeys.config.ts` |
| `templates/` | The config `init` creates |
| `integrations/` | Claude Code, Cursor, AGENTS.md and GitHub Actions files |
| `examples/demo-app/` | A tiny app with signup/login/checkout; `--break=signup` breaks it on purpose |

## Good first contributions

- **Journey templates** for common stacks: Supabase auth, Clerk, NextAuth, Stripe Checkout in test mode, magic links.
- **Integrations** for more agents and CI providers (GitLab CI, Netlify, Cloudflare Pages).
- **Report improvements:** anything that helps an agent find the root cause faster.

## Rules of the road

- **No telemetry, ever.** stillworks must not send data anywhere except the app being checked.
- Keep dependencies minimal (today: `playwright` and `jiti`).
- It must work on Windows, macOS and Linux. CI runs all three.
- Add a test for behavior changes. End-to-end tests go in `test/e2e.test.mjs` and use the demo app.
- Write user-facing text in plain English, short sentences, no jargon.

## Releasing (maintainers)

1. Bump `version` in `package.json` and commit.
2. `git tag v<version> && git push --tags`

The Release workflow runs the tests and publishes to npm with trusted publishing. No npm token is involved.

## Reporting bugs

Use the [bug report template](https://github.com/valmirjunior2109-spec/stillworks/issues/new?template=bug_report.yml). Include your OS, Node version, the command you ran and the relevant part of `verify-report/REPORT.md`. **Remove secrets, emails and internal URLs first.**
