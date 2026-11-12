# Show HN

Post at https://news.ycombinator.com/submit. Best window: Tuesday to Thursday, 8–10am US Eastern.
Leave the text box empty when you submit a URL, then post the comment below as the first comment, right away.
Stay in the thread for the first 2–3 hours and answer every comment. Don't ask anyone to upvote (HN penalizes it).

**Title** (80 chars max):

```
Show HN: Stillworks – check signup/login/checkout still work after AI edits
```

**URL:** https://github.com/valmirjunior2109-spec/stillworks

**First comment:**

```
Hi HN. A common failure with Claude Code and Cursor: the change compiles, lint and unit tests pass, and signup is broken anyway, often because the agent "cleaned up" a file it wasn't asked to touch. Nobody clicked through the app.

stillworks is a small CLI around Playwright that does the clicking:

- `npx stillworks init` writes a journeys.config.ts with editable signup/login/checkout examples
- `npx stillworks run --url http://localhost:3000` runs each journey in Chromium, screenshots every step, and records console errors and failed requests (with the start of the response body for your own origin)
- it exits 1 when something breaks and writes REPORT.md as a prompt you paste back into the agent: which step failed, the 500 and its error message, the screenshot, and "fix this without changing unrelated files"

There's also a Claude Code Stop hook: when the agent says it's done, the journeys run, and if one fails the report goes back to the agent so it keeps working. It skips turns where no file changed and never blocks when the app isn't running.

Journeys are plain Playwright code, so it's deliberately not "AI testing": deterministic steps you can read, with the AI only on the fixing side.

The repo has a demo app with a broken signup (`npm run demo:broken`) if you want to see it catch something in 30 seconds. MIT, no telemetry, Node 20+, CI on macOS/Linux/Windows.

I'm building a hosted version that runs this on every PR and diffs against the last working run, but the CLI is useful on its own and it stays free. Feedback on the report format especially welcome: what would make your agent fix things faster?
```
