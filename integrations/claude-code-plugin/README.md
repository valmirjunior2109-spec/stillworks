# stillworks plugin for Claude Code

Installs, in one step, what `npx stillworks init --claude` and `claude mcp add` set up by hand:

- the `/verify` command: Claude runs your journeys, reads the report, fixes what broke and runs them again;
- the stillworks MCP server, so Claude can call `check_app` and `run_journeys` by itself after a change.

```
/plugin marketplace add valmirjunior2109-spec/stillworks
/plugin install stillworks@stillworks
```

Run `npx stillworks install` once so Chromium is there, and `npx stillworks init` to create `journeys.config.ts`
(`check_app` works without it).

The plugin doesn't add the Stop hook that checks after every turn. If you want it, add it from
[../claude-code/README.md](../claude-code/README.md).

When you change `commands/verify.md`, change [../claude-code/commands/verify.md](../claude-code/commands/verify.md)
too: `init --claude` copies that one.
