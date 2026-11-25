# stillworks in your AI coding tool

stillworks is an MCP server. Once it's connected, your agent can check the app itself after a change, before it says "done":

| Tool | What it does |
| --- | --- |
| `check_app` | Opens the app and up to 6 key pages (signup, login, pricing, dashboard first) in a real browser. Reports pages that don't load, "not found" screens, blank pages, JavaScript crashes and 5xx responses from your API. Read-only: never fills a form or clicks a button. Zero setup. |
| `run_journeys` | Runs your `journeys.config.ts` (signup, login, checkout…) and reports the step that failed, with console errors and the server's response. Local server only. |

There are two ways to connect, depending on where your agent runs:

- **On your machine** (Claude Code, Cursor, VS Code, Windsurf, Codex, Claude Desktop, Gemini CLI): the local server, `npx -y stillworks mcp`. It can check `localhost`, and it has both tools. Run `npx stillworks install` once so the browser is there.
- **In the cloud** (Lovable, Bolt, Replit, claude.ai, ChatGPT): those can't start a program on your machine, so they connect to a URL, the **hosted** server. It only has `check_app`, and only for public URLs (your published or preview app).

---

## On your machine

### Claude Code

```sh
claude mcp add stillworks -- npx -y stillworks mcp
```

Add `--scope project` to share it with your team through `.mcp.json`. For a check every time Claude finishes, add the [Stop hook](claude-code/README.md).

### Cursor

[Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=stillworks&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInN0aWxsd29ya3MiLCJtY3AiXX0=) (one click), or add it to `.cursor/mcp.json`:

```json
{ "mcpServers": { "stillworks": { "command": "npx", "args": ["-y", "stillworks", "mcp"] } } }
```

`npx stillworks init --cursor` also adds a [rule](cursor/rules/stillworks.mdc) telling the agent to check after every change.

### VS Code (GitHub Copilot agent mode)

```sh
code --add-mcp '{"name":"stillworks","command":"npx","args":["-y","stillworks","mcp"]}'
```

Or in `.vscode/mcp.json`:

```json
{ "servers": { "stillworks": { "command": "npx", "args": ["-y", "stillworks", "mcp"] } } }
```

### Windsurf

In `~/.codeium/windsurf/mcp_config.json`:

```json
{ "mcpServers": { "stillworks": { "command": "npx", "args": ["-y", "stillworks", "mcp"] } } }
```

### OpenAI Codex CLI

```sh
codex mcp add stillworks -- npx -y stillworks mcp
```

Or in `~/.codex/config.toml`:

```toml
[mcp_servers.stillworks]
command = "npx"
args = ["-y", "stillworks", "mcp"]
```

### Claude Desktop

In `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{ "mcpServers": { "stillworks": { "command": "npx", "args": ["-y", "stillworks", "mcp"] } } }
```

### Gemini CLI

```sh
gemini mcp add stillworks npx -y stillworks mcp
```

### Any other MCP client

Command `npx`, arguments `-y stillworks mcp`, transport stdio. If the client only takes a URL, run the same server over HTTP on your machine:

```sh
npx -y stillworks mcp --http        # → http://127.0.0.1:8787/mcp
```

It only listens on this machine and refuses requests from web pages that aren't on `localhost`.

---

## In the cloud: Lovable, Bolt, Replit, claude.ai, ChatGPT

These connect to the hosted server's URL (Streamable HTTP):

```
https://<your-host>/mcp
```

Deploy it yourself in a few minutes (see [Hosting the server](#hosting-the-server)), or use the one Publishub runs, once it's announced in the [README](../README.md).

Then tell the agent, after a change: *"Publish, then call check_app on the published URL and fix what it reports."*

Each tool adds remote MCP servers in its own place, and these screens change often, so check the tool's docs if a step doesn't match:

- **claude.ai** (and Claude Desktop): Settings → Connectors → Add custom connector → paste the URL.
- **ChatGPT**: Settings → Connectors (developer mode) → add the URL as an MCP server.
- **Replit Agent**: add it as an MCP server in the Agent's integrations, if your plan has them, with the URL above.
- **Bolt**: if your Bolt workspace offers MCP connectors, add the URL there.
- **Lovable**: Lovable's agent doesn't take your own MCP servers today. Two ways that work:
  1. **Build the Lovable app from Claude Code, Cursor or Codex** with [Lovable's own MCP server](https://docs.lovable.dev), and add stillworks next to it (local or hosted). The same agent builds in Lovable and checks the published app.
  2. **Check every change from GitHub.** Connect the project to GitHub in Lovable (it syncs every change), then add the [stillworks GitHub Action](github-actions/stillworks.yml) to that repository, pointed at your published URL. The same works for Bolt projects exported to GitHub.

No MCP at all? Paste your published URL into [Publishub's free check](https://getpublishub.com/check?utm_source=gh_integrations).

### What the hosted server will and won't do

- Only `check_app`, only for **public** `http(s)` URLs. `localhost`, private networks (10.x, 192.168.x…), link-local and cloud metadata addresses are refused, and the browser is blocked from requesting them while it checks your app.
- Read-only, like the local `check_app`: it opens pages, never logs in, fills a form or clicks a button.
- Every check runs in its own temporary folder, deleted when it finishes. Screenshots of failed pages are sent back to the agent as images, not stored.
- 20 checks per client per hour (`STILLWORKS_RATE_LIMIT`), one at a time.

---

## Hosting the server

The hosted server is the same package with `--http --hosted`, in the [Dockerfile](../Dockerfile) at the repository root (Playwright's image, so Chromium is included).

**Fly.io** (the repository has a [`fly.toml`](../fly.toml)):

```sh
fly launch --copy-config --no-deploy
fly deploy
```

**Render, Railway, Google Cloud Run** or anything that runs a Dockerfile: point it at this repository. The server reads `PORT`, answers `GET /health` and needs about 1 GB of memory for Chromium.

**Without Docker** (a machine with Chromium's system libraries):

```sh
npx -y stillworks install --with-deps
npx -y stillworks mcp --http --hosted --port 8787 --trust-proxy
```

Settings, all optional:

| Variable | What it does |
| --- | --- |
| `STILLWORKS_MCP_TOKEN` | Require `Authorization: Bearer <token>` on every request (a private server for you or your team). |
| `STILLWORKS_RATE_LIMIT` | Checks per client per hour. Default 20. |
| `PORT` | Default 8787. |

`--trust-proxy` reads the client's address from `X-Forwarded-For`, for the rate limit. Use it only behind a proxy you control (Fly, Render, Railway all set it); otherwise anyone can claim any address.

Run it somewhere that can't reach anything private anyway (a plain container on Fly, Render or Cloud Run is). The address checks are a second layer, not a sandbox.
