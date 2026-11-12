# X thread (5 posts)

Attach `assets/demo.gif` to post 1 and a screenshot of `examples/REPORT.example.md` to post 4.
Each post is under 280 characters (links count as 23).

---

**1/5**

Your AI writes the code. Who checks it still works?

I just open-sourced stillworks: one command runs signup, login and checkout in a real browser and tells your agent exactly what broke.

npx stillworks init

🧵

---

**2/5**

The bug I kept shipping with Claude Code and Cursor:

Code compiles. Lint passes. Tests pass.
Signup is broken anyway, because the agent "cleaned up" a file it wasn't supposed to touch.

Unit tests check functions. Nobody checks the flow a user actually clicks.

---

**3/5**

How it works:

1. Write journeys as plain Playwright steps (or ask your agent to)
2. npx stillworks run --url localhost:3000
3. Every step gets a screenshot; console errors and failed requests are captured
4. Exit code 1 if anything broke

---

**4/5**

The report is written as a prompt for your agent:

"signup failed at step 4. POST /api/signup → 500: Cannot read properties of undefined. Fix this without changing unrelated files."

Paste it in, or add the Claude Code hook and it's fixed before the agent says "done".

---

**5/5**

MIT, no telemetry, Mac/Linux/Windows. Ships with a /verify command for Claude Code, a Cursor rule and a GitHub Action for Vercel previews.

⭐ https://github.com/valmirjunior2109-spec/stillworks

Want it on every change, with regression diffs? We're building that: https://getpublishub.com/?utm_source=x_thread
