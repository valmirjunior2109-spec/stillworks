# MCP and agent directories

People choosing tools for their agent browse these. Unlike a launch post, a listing keeps sending people for months.
Already listed: [Glama](https://glama.ai/mcp/servers/valmirjunior2109-spec/stillworks) and the official MCP Registry
(`io.github.valmirjunior2109-spec/stillworks`, published by the release workflow).

| Where | How | Status |
| --- | --- | --- |
| Claude Code plugin marketplace (this repo) | Done: `.claude-plugin/marketplace.json`. Install: `/plugin marketplace add valmirjunior2109-spec/stillworks` | ready |
| Smithery (smithery.ai) | Sign in with GitHub → "Add server" → pick this repo. Local server, command `npx -y stillworks mcp` | to do |
| PulseMCP (pulsemcp.com) | "Submit" form; it also picks up servers from the official registry | to do |
| mcp.so | "Submit" → GitHub URL | to do |
| Cursor Directory (cursor.directory/mcp) | "Submit" → GitHub URL; mention the one-click install link from the README | to do |
| awesome-mcp-servers (github.com/punkpeye/awesome-mcp-servers) | Pull request, category "Testing" (or "Browser Automation"), alphabetical | to do |
| awesome-claude-code / awesome-cursorrules / awesome-playwright | See [awesome-lists.md](awesome-lists.md) | to do |
| Claude Code plugin lists (search GitHub for "claude code plugins marketplace") | Pull request adding `valmirjunior2109-spec/stillworks` | to do |

## Text to reuse

**Name:** stillworks

**One line:** Your AI writes the code, this checks it still works: runs signup, login and checkout in a real browser
and returns a bug report your coding agent can fix.

**Description:**

> stillworks gives your agent two tools. `check_app` opens an app and its key pages in a real browser (zero setup,
> read-only) and reports pages that don't load, "not found" screens, JavaScript crashes and 5xx errors.
> `run_journeys` runs your signup, login and checkout journeys (plain Playwright steps) and returns the step that
> failed, console errors, failed requests with the server's response, and screenshots. Local: `npx -y stillworks mcp`.
> Cloud builders (Lovable, Bolt, Replit) and remote connectors (claude.ai, ChatGPT) can use the free public server at
> `https://HF_USER-stillworks-mcp.hf.space/mcp`. MIT, no telemetry.

**Categories / tags:** testing, browser automation, developer tools, playwright, e2e, vibe coding

**awesome-mcp-servers line** (match their emoji legend when you submit):

```md
- [valmirjunior2109-spec/stillworks](https://github.com/valmirjunior2109-spec/stillworks) 📇 🏠 ☁️ - Runs your app's signup, login and checkout in a real browser after AI code changes and returns a bug report (failed step, console errors, failed requests, screenshots) the agent can fix.
```
