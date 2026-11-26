// Runs the real CLI, in a real browser, against examples/demo-app. Needs Chromium: npx stillworks install
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(ROOT, "dist", "cli.js");
const servers = [];
let project, healthy, broken, unsaved, brokenPages, noInvites;

function startDemo(...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(ROOT, "examples", "demo-app", "server.mjs"), ...args], { env: { ...process.env, PORT: "0" } });
    servers.push(child);
    child.stdout.on("data", (chunk) => {
      const match = String(chunk).match(/ready on (http:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    child.on("exit", (code) => reject(new Error(`demo app exited with ${code}`)));
  });
}

function cli(args, { env = {}, input } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd: project, env: { ...process.env, NO_COLOR: "1", NO_PUBLISHUB_PROMO: "", ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    if (input !== undefined) child.stdin.end(input);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

before(async () => {
  [healthy, broken, unsaved, brokenPages, noInvites] = await Promise.all([
    startDemo(),
    startDemo("--break=signup"),
    startDemo("--break=save"),
    startDemo("--break=pages"),
    startDemo("--break=invite"),
  ]);
  project = mkdtempSync(join(tmpdir(), "stillworks-e2e-"));
});

after(async () => {
  // Windows keeps a folder locked while a process started in it is still exiting: wait for every one first
  await Promise.all(
    servers.map((server) =>
      server.exitCode !== null || server.signalCode !== null
        ? undefined
        : new Promise((resolve) => {
            server.once("exit", resolve);
            server.kill();
          }),
    ),
  );
  rmSync(project, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("init creates the example config and ignores the report folder", async () => {
  const { code, stdout } = await cli(["init", "--skip-install", "--claude", "--cursor", "--github"]);
  assert.equal(code, 0, stdout);
  assert.ok(existsSync(join(project, "journeys.config.ts")));
  assert.match(readFileSync(join(project, ".gitignore"), "utf8"), /^verify-report\/$/m);
  for (const file of [".claude/commands/verify.md", ".cursor/rules/stillworks.mdc", ".github/workflows/stillworks.yml"]) {
    assert.ok(existsSync(join(project, file)), file);
  }
  assert.match(stdout, /utm_source=gh_init/);
  assert.ok(!existsSync(join(project, "node_modules")), "--skip-install installs nothing");
  const again = await cli(["init", "--skip-install", "--no-promo"]);
  assert.match(again.stdout, /already exists/);
  assert.doesNotMatch(again.stdout, /getpublishub/);
});

test("a broken signup fails the run and the report says exactly where", async () => {
  const { code, stdout } = await cli(["run", "--url", broken]);
  assert.equal(code, 1, stdout);
  assert.match(stdout, /✗ signup\s+failed at step 4\/4: "See the welcome screen"/);
  assert.match(stdout, /✓ login/);
  assert.match(stdout, /✓ checkout/);
  assert.match(stdout, /POST \/api\/signup → 500/);
  assert.match(stdout, /utm_source=gh_cli/);

  const report = readFileSync(join(project, "verify-report", "REPORT.md"), "utf8");
  assert.match(report, /The `signup` journey failed at step 4 of 4: "See the welcome screen"/);
  assert.match(report, /POST \/api\/signup → 500 Internal Server Error/);
  assert.match(report, /Cannot read properties of undefined \(reading 'toLowerCase'\)/);
  assert.match(report, /Screenshot: verify-report\/screenshots\/signup-04-see-the-welcome-screen\.png/);
  assert.match(report, /Fix this without changing unrelated files\./);
  assert.match(report, /utm_source=gh_report/);

  const shots = readdirSync(join(project, "verify-report", "screenshots"));
  assert.ok(shots.includes("signup-04-see-the-welcome-screen.png"), shots.join(", "));
  const json = JSON.parse(readFileSync(join(project, "verify-report", "report.json"), "utf8"));
  assert.equal(json.journeys.find((j) => j.name === "signup").status, "failed");
});

test("a healthy app passes, and the promo line can be turned off", async () => {
  const pass = await cli(["run", "--url", healthy]);
  assert.equal(pass.code, 0, pass.stdout);
  assert.match(pass.stdout, /All 3 journeys passed/);
  assert.match(pass.stdout, /utm_source=gh_cli/);

  assert.match(readFileSync(join(project, "verify-report", "REPORT.md"), "utf8"), /tested%20with-stillworks/);

  const flag = await cli(["run", "--url", healthy, "--no-promo", "--journey", "login"]);
  assert.equal(flag.code, 0, flag.stdout);
  assert.doesNotMatch(readFileSync(join(project, "verify-report", "REPORT.md"), "utf8"), /tested%20with-stillworks/, "--no-promo hides the badge");
  assert.doesNotMatch(flag.stdout, /getpublishub/);
  assert.match(flag.stdout, /All 1 journey passed/);

  const env = await cli(["run", "--url", healthy, "-j", "login"], { env: { NO_PUBLISHUB_PROMO: "1" } });
  assert.doesNotMatch(env.stdout, /getpublishub/);
});

test("setup problems exit 2 with a plain explanation", async () => {
  const missing = await cli(["run", "--url", healthy, "--config", "nope.config.ts"]);
  assert.equal(missing.code, 2);
  assert.match(missing.stderr, /Couldn't find nope\.config\.ts/);

  const down = await cli(["run", "--url", "http://127.0.0.1:9"]);
  assert.equal(down.code, 2);
  assert.match(down.stderr, /Couldn't reach http:\/\/127\.0\.0\.1:9 \(from --url\)/);
  assert.match(down.stderr, /--url https:\/\/your-app\.com/);

  // The example journeys sign up and pay: they never run against someone else's site, and no request is made.
  const example = await cli(["run", "--url", "https://example.com"]);
  assert.equal(example.code, 2);
  assert.match(example.stderr, /still has the example journeys/);
  assert.match(example.stderr, /example\.com/);

  writeFileSync(join(project, "broken.config.ts"), 'import { defineConfig } from "stillworks";\nexport default defineConfig({\n  journeys: [\n  ],\n  ],\n});\n');
  const syntax = await cli(["run", "--url", healthy, "--config", "broken.config.ts"]);
  assert.equal(syntax.code, 2);
  assert.match(syntax.stderr, /broken\.config\.ts has a syntax error at line 5/);

  const unknown = await cli(["run", "--url", healthy, "--journey", "nope"]);
  assert.equal(unknown.code, 2);
  assert.match(unknown.stderr, /No journey called "nope"/);
});

test("Claude Code hook: blocks with the report, then stays quiet until files change", async () => {
  const git = (...args) => execFileSync("git", args, { cwd: project, stdio: "ignore" });
  git("init", "-q");
  const env = { STILLWORKS_URL: broken };

  const looping = await cli(["hook", "claude-code"], { env, input: JSON.stringify({ stop_hook_active: true }) });
  assert.equal(looping.code, 0, "never re-block while the agent is already fixing");

  const first = await cli(["hook", "claude-code"], { env, input: JSON.stringify({ stop_hook_active: false }) });
  assert.equal(first.code, 2, first.stderr);
  assert.match(first.stderr, /a user journey broke/);
  assert.match(first.stderr, /The `signup` journey failed/);
  assert.doesNotMatch(first.stdout, /getpublishub/);

  const unchanged = await cli(["hook", "claude-code"], { env, input: "{}" });
  assert.equal(unchanged.code, 0, "nothing changed since the last check");

  writeFileSync(join(project, "changed.txt"), "the agent edited something");
  const down = await cli(["hook", "claude-code"], { env: { STILLWORKS_URL: "http://127.0.0.1:9" }, input: "{}" });
  assert.match(down.stderr, /skipped \(Couldn't reach/);
  assert.equal(down.code, 0, "an app that isn't running never blocks the agent");
});

test("recipes run as written: read-the-data-back catches a save that never happened", async () => {
  const recipe = join(ROOT, "recipes", "read-the-data-back.ts");
  const ok = await cli(["run", "--url", healthy, "--config", recipe, "--no-promo"]);
  assert.equal(ok.code, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /✓ save-and-read-back/);

  // The API answers 200 and the "Saved!" message shows, but the note is gone after a reload.
  const bad = await cli(["run", "--url", unsaved, "--config", recipe, "--no-promo"]);
  assert.equal(bad.code, 1, bad.stdout + bad.stderr);
  assert.match(bad.stdout, /✗ save-and-read-back\s+failed at step 6\/6: "See the note after reloading"/);

  const login = await cli(["run", "--url", healthy, "--config", join(ROOT, "recipes", "login-with-test-account.ts"), "--no-promo"]);
  assert.equal(login.code, 0, login.stdout + login.stderr);
  assert.match(login.stdout, /✓ login/);
});

test("recipes run as written: invite-a-teammate catches an invite that was never stored", async () => {
  const recipe = join(ROOT, "recipes", "invite-a-teammate.ts");
  const ok = await cli(["run", "--url", healthy, "--config", recipe, "--no-promo"]);
  assert.equal(ok.code, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /✓ invite-a-teammate/);

  // The API answers 200 and "Invite sent" shows, but the pending invite isn't in the list after a reload.
  const bad = await cli(["run", "--url", noInvites, "--config", recipe, "--no-promo"]);
  assert.equal(bad.code, 1, bad.stdout + bad.stderr);
  assert.match(bad.stdout, /✗ invite-a-teammate\s+failed at step 10\/10: "See the pending invite after reloading"/);
});

test("check: zero setup, read-only, finds the pages and passes a healthy app", async () => {
  const empty = mkdtempSync(join(tmpdir(), "stillworks-check-"));
  try {
    const result = await new Promise((resolve) => {
      const child = spawn(process.execPath, [CLI, "check", healthy, "--no-promo"], { cwd: empty, env: { ...process.env, NO_COLOR: "1" } });
      let stdout = "";
      child.stdout.on("data", (c) => (stdout += c));
      child.on("close", (code) => resolve({ code, stdout }));
    });
    assert.equal(result.code, 0, result.stdout);
    assert.match(result.stdout, /5 pages: \/  \/signup  \/login  \/checkout  \/notes/);
    assert.match(result.stdout, /All 5 pages look fine/);
    assert.match(result.stdout, /npx stillworks init/);
    assert.ok(existsSync(join(empty, "verify-report", "REPORT.md")), "writes the same report as run");
    assert.doesNotMatch(readFileSync(join(empty, "verify-report", "REPORT.md"), "utf8"), /tested%20with-stillworks/, "no badge for a first look");
    assert.ok(!existsSync(join(empty, "journeys.config.ts")), "needs no config and creates none");
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test("check: a missing page, a JavaScript crash and a 500 from the API fail it, with a report for the agent", async () => {
  const result = await cli(["check", brokenPages, "--no-promo"]);
  assert.equal(result.code, 1, result.stdout);
  assert.match(result.stdout, /\/docs .*failed at step 1\/4: "Open \/docs"/);
  assert.match(result.stdout, /\/notes .*failed at step 3\/4: "No JavaScript crash"/);
  assert.match(result.stdout, /\/checkout .*failed at step 4\/4: "No server errors from your app"/);
  assert.match(result.stdout, /3 of 6 pages have a problem/);
  const report = readFileSync(join(project, "verify-report", "REPORT.md"), "utf8");
  assert.match(report, /The server answered 404/);
  assert.match(report, /Cannot read properties of undefined \(reading 'mount'\)/);
  assert.match(report, /POST \/api\/plan → 500/);
  assert.match(report, /npx stillworks check /);
});

test("mcp: an agent lists the tools and runs check_app over stdio", async () => {
  const child = spawn(process.execPath, [CLI, "mcp"], { cwd: project, env: { ...process.env, NO_COLOR: "1" } });
  const replies = new Map();
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    for (let at = buffer.indexOf("\n"); at > -1; at = buffer.indexOf("\n")) {
      const message = JSON.parse(buffer.slice(0, at));
      buffer = buffer.slice(at + 1);
      replies.set(message.id, message);
    }
  });
  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
  const waitFor = async (id) => {
    for (let i = 0; i < 600 && !replies.has(id); i++) await new Promise((r) => setTimeout(r, 100));
    return replies.get(id);
  };
  try {
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "check_app", arguments: { url: brokenPages } } });
    send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "check_app", arguments: { url: "http://127.0.0.1:9" } } });

    assert.equal((await waitFor(1)).result.serverInfo.name, "stillworks");
    assert.deepEqual((await waitFor(2)).result.tools.map((t) => t.name), ["check_app", "run_journeys"]);
    const check = (await waitFor(3)).result;
    assert.ok(!check.isError);
    assert.match(check.content[0].text, /3 of 6 pages failed/);
    assert.match(check.content[0].text, /POST \/api\/plan → 500/);
    const unreachable = (await waitFor(4)).result;
    assert.equal(unreachable.isError, true);
    assert.match(unreachable.content[0].text, /Couldn't reach/);
  } finally {
    child.stdin.end();
    child.kill();
  }
});

/** Starts `stillworks mcp --http` on a free port and returns a JSON-RPC poster for it. */
async function startHttpMcp(args = [], env = {}) {
  const child = spawn(process.execPath, [CLI, "mcp", "--http", "--port", "0", ...args], { cwd: project, env: { ...process.env, NO_COLOR: "1", ...env } });
  servers.push(child);
  const base = await new Promise((resolve, reject) => {
    child.stderr.on("data", (chunk) => {
      const match = String(chunk).match(/listening on (http:\/\/\S+)\/mcp/);
      if (match) resolve(match[1].replace("0.0.0.0", "127.0.0.1"));
    });
    child.on("exit", (code) => reject(new Error(`mcp --http exited with ${code}`)));
  });
  const post = async (message, headers = {}) => {
    const response = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
      body: JSON.stringify(message),
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
  };
  return { base, post, child };
}

const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } };

test("mcp --http: the same tools over Streamable HTTP, and websites can't drive a local server", async () => {
  const { base, post, child } = await startHttpMcp();
  try {
    const init = await post(INIT);
    assert.equal(init.status, 200);
    assert.equal(init.body.result.serverInfo.name, "stillworks");
    assert.ok(init.headers.get("mcp-session-id"));
    assert.equal((await post({ jsonrpc: "2.0", method: "notifications/initialized" })).status, 202);
    assert.deepEqual((await post({ jsonrpc: "2.0", id: 2, method: "tools/list" })).body.result.tools.map((t) => t.name), ["check_app", "run_journeys"]);
    const check = (await post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "check_app", arguments: { url: brokenPages } } })).body.result;
    assert.ok(!check.isError);
    assert.match(check.content[0].text, /3 of 6 pages failed/);
    assert.equal((await fetch(`${base}/mcp`)).status, 405);
    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.equal((await post(INIT, { origin: "https://evil.example" })).status, 403);
    assert.equal((await post(INIT, { origin: "http://localhost:5173" })).status, 200);
    assert.equal((await post([INIT])).status, 400);
  } finally {
    child.kill();
  }
});

test("mcp --http --hosted: check_app only, never localhost or a private network, token when set", async () => {
  const { post, child } = await startHttpMcp(["--hosted", "--host", "127.0.0.1"], { STILLWORKS_MCP_TOKEN: "s3cret" });
  const auth = { authorization: "Bearer s3cret" };
  try {
    assert.equal((await post(INIT)).status, 401);
    assert.equal((await post(INIT, { authorization: "Bearer wrong!" })).status, 401);
    const init = await post(INIT, { ...auth, origin: "https://lovable.dev" });
    assert.equal(init.status, 200);
    assert.equal(init.headers.get("access-control-allow-origin"), "*");
    assert.deepEqual((await post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, auth)).body.result.tools.map((t) => t.name), ["check_app"]);
    for (const url of [healthy, "http://169.254.169.254/latest/meta-data", "http://10.0.0.1", "http://[::1]:3000", "file:///etc/passwd"]) {
      const result = (await post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "check_app", arguments: { url } } }, auth)).body.result;
      assert.equal(result.isError, true, url);
      assert.match(result.content[0].text, /isn't a public address|Only http and https/, url);
    }
    const journeys = (await post({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "run_journeys", arguments: {} } }, auth)).body;
    assert.equal(journeys.error.code, -32602);
  } finally {
    child.kill();
  }
});
