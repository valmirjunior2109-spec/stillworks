---
title: stillworks MCP
emoji: ✅
colorFrom: purple
colorTo: indigo
sdk: docker
app_port: 8787
pinned: false
license: mit
short_description: Check that a public web app still works, from your agent
---

# stillworks hosted MCP server

The public [stillworks](https://github.com/valmirjunior2109-spec/stillworks) MCP server for cloud builders and remote
connectors (Lovable, Bolt, Replit, claude.ai, ChatGPT). Connect your MCP client to this Space's URL plus `/mcp`
(Streamable HTTP).

- One tool, `check_app`: opens a **public** URL and its key pages in a real browser, read-only, and reports pages
  that don't load, "not found" screens, JavaScript crashes and 5xx errors.
- Private networks, localhost and cloud metadata addresses are refused. 20 checks per client per hour.
- Nothing is stored: every check runs in a temporary folder deleted when it finishes.

This Space is deployed from the GitHub repository by `.github/workflows/deploy-hosted-mcp.yml`. Don't edit it here:
changes are overwritten on the next deploy.
