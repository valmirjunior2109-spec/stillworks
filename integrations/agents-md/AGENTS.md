<!-- Paste this section into the AGENTS.md at the root of your project. Codex, GitHub Copilot, Windsurf, Cursor and others read it. -->

## Verify user journeys before finishing

After changing application code, check the app still works in a real browser:

1. Make sure the dev server is running.
2. Run `npx stillworks run --no-promo`.
3. If a journey fails, read `verify-report/REPORT.md` and the screenshot it points to, then fix the root cause.
   Don't change unrelated files, and don't edit `journeys.config.ts` to make a check pass.
4. Repeat until every journey passes.
