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
let project, healthy, broken;

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
  [healthy, broken] = await Promise.all([startDemo(), startDemo("--break=signup")]);
  project = mkdtempSync(join(tmpdir(), "stillworks-e2e-"));
});

after(() => {
  for (const server of servers) server.kill();
  rmSync(project, { recursive: true, force: true });
});

test("init creates the example config and ignores the report folder", async () => {
  const { code, stdout } = await cli(["init", "--skip-install", "--claude", "--cursor", "--github"]);
  assert.equal(code, 0, stdout);
  assert.ok(existsSync(join(project, "journeys.config.ts")));
  assert.match(readFileSync(join(project, ".gitignore"), "utf8"), /^verify-report\/$/m);
  for (const file of [".claude/commands/verify.md", ".cursor/rules/stillworks.mdc", ".github/workflows/stillworks.yml"]) {
    assert.ok(existsSync(join(project, file)), file);
  }
  const again = await cli(["init", "--skip-install"]);
  assert.match(again.stdout, /already exists/);
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

  const flag = await cli(["run", "--url", healthy, "--no-promo", "--journey", "login"]);
  assert.equal(flag.code, 0, flag.stdout);
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
  assert.match(down.stderr, /Couldn't reach/);

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
