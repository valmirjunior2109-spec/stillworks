# Reddit

Post from your own account, one subreddit per day (posting the same thing everywhere at once gets flagged as spam).
Read each subreddit's rules first: some only allow self-promotion on certain days or with a specific flair.
Upload `assets/demo.gif` as the post's media when the subreddit allows it, and put the link in the text.
Reply to every comment in the first hours.

---

## r/ClaudeAI (flair: "Built with Claude" or "Productivity")

**Title:** I made Claude Code check that signup/login/checkout still work before it says "done"

**Text:**

Claude Code can hand you a change that compiles and passes tests but breaks signup, often in a file it wasn't asked to touch.

So I built stillworks, an open-source CLI that runs your critical user journeys in a real browser (Playwright) and writes the failure as a prompt Claude can act on: the step that failed, the console error, the failed request with the server's response, the screenshot, and "fix this without changing unrelated files".

The most useful part is the Stop hook: when Claude finishes, the journeys run. If one fails, the report goes straight back to Claude and it keeps working until it passes. It skips turns where no file changed, so chat-only turns cost nothing.

```
npx stillworks init --claude
npx stillworks run --url http://localhost:3000
```

MIT, no telemetry: https://github.com/valmirjunior2109-spec/stillworks

Curious what flows you'd want checked first.

---

## r/cursor

**Title:** A Cursor rule + CLI that makes the agent verify your app in a real browser after each change

**Text:**

Cursor's agent is fast, but "tests pass" doesn't mean the signup button still works. I built an open-source CLI, stillworks, that runs signup/login/checkout in Chromium and writes a fix-ready report when something breaks.

`npx stillworks init --cursor` adds a rule that tells the agent to run it after every change, read `verify-report/REPORT.md` if it fails, fix the root cause without touching unrelated files, and re-run.

Repo (MIT): https://github.com/valmirjunior2109-spec/stillworks

---

## r/SideProject or r/indiehackers

**Title:** I open-sourced a CLI that catches the bugs AI agents ship

**Text:**

Founder here, building with Claude Code. The scary AI bugs aren't the ones tests catch. They're "signup silently does nothing" after an innocent-looking refactor.

stillworks runs your critical journeys (signup, login, checkout) in a real browser after each change and gives your agent a report it can fix from. It's free, MIT, and takes 30 seconds to try on the bundled demo app with a broken signup.

https://github.com/valmirjunior2109-spec/stillworks

I'm also building a hosted version that runs on every PR with regression diffs. If that's useful to you, the waitlist is at https://getpublishub.com/?utm_source=reddit

---

## r/webdev (Showoff Saturday only: post on a Saturday)

**Title:** [Showoff Saturday] stillworks: run signup/login/checkout in a real browser after every AI code change

**Text:** use the r/SideProject text, without the waitlist line.

---

## r/vibecoding

**Title:** Vibe coding safety net: check your app still works after every AI change (open source)

**Text:** use the r/ClaudeAI text, and replace the Claude-specific paragraph with: "Works with Claude Code, Cursor, Codex and Copilot: there's a ready-made command, rule or AGENTS.md snippet for each."
