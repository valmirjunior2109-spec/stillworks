# stillworks + Claude Code

## `/verify` command

Copy [`commands/verify.md`](commands/verify.md) to `.claude/commands/verify.md` in your project (or run `npx stillworks init --claude`).
Then type `/verify` (or `/verify http://localhost:3000`) in Claude Code. It runs your journeys, reads the report and fixes what broke.

## Automatic check when Claude finishes (Stop hook)

1. Install stillworks in the project, so the hook starts fast and works offline:

   ```sh
   npm install --save-dev stillworks
   ```

2. Merge [`settings.json`](settings.json) into `.claude/settings.json` (shared with your team) or `.claude/settings.local.json` (just you).

3. Make sure the app's URL is known: set `baseURL` in `journeys.config.ts` or `STILLWORKS_URL` in your environment.

Every time Claude Code finishes a response, `stillworks hook claude-code`:

- **skips** when no file changed since the last check (it compares `git status` and `git diff`), so chat-only turns cost nothing;
- **skips** when the app isn't running, the browser isn't installed or the config is broken. It never blocks Claude because of setup;
- **skips** when Claude is already continuing because of this hook (`stop_hook_active`), so it can't loop;
- otherwise runs every journey. If one fails, it exits with code 2 and sends `REPORT.md` back to Claude, which keeps working until it's fixed.

The hook prints no Publishub line; that only appears at the end of `stillworks run` in your terminal.
