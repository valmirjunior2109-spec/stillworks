---
description: Check that signup, login and checkout still work in a real browser, then fix what broke
argument-hint: "[url]"
allowed-tools: Bash(npx stillworks run:*), Read
---

Check that the app still works for real users, in a real browser.

1. Run `npx stillworks run --no-promo`. If a URL was given here, add `--url` with it: $ARGUMENTS
   If it says the app isn't reachable, start the dev server and run it again.
2. If every journey passed, say so in one line and stop.
3. If a journey failed, read `verify-report/REPORT.md` and look at the screenshot it points to.
   Find the root cause, starting from the failed requests and console errors, and fix it.
   Don't change unrelated files, and don't edit `journeys.config.ts` to make a check pass.
4. Run step 1 again. Repeat until every journey passes, at most 3 times.
5. Finish with what broke, why, and what you changed.
