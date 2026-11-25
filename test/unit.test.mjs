import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { baseURLSource, isLocalURL, parseHeaders, resolveBaseURL } from "../dist/args.js";
import { UsageError, isExampleConfig, loadErrorMessage, validateConfig } from "../dist/config.js";
import { addDevCommand, hasLocalPackage, nextSteps } from "../dist/setup.js";
import { CLI_FAIL_PROMO, CLI_PROMO, INIT_PROMO, REPORT_FAIL_PROMO_URL, REPORT_PROMO_URL, cliPromo, shouldShowPromo } from "../dist/promo.js";
import { BADGE_MARKDOWN, looksLikeJourneyProblem, renderReport } from "../dist/report.js";
import { cleanError, slug } from "../dist/runner.js";
import { looksLikeErrorScreen, pickPages, smokeConfig } from "../dist/smoke.js";

const cwd = process.cwd();
const failedRun = {
  baseURL: "http://localhost:3000",
  startedAt: "2026-11-11T12:00:00.000Z",
  durationMs: 4200,
  journeys: [
    {
      name: "signup",
      status: "failed",
      failedStep: 2,
      durationMs: 3000,
      steps: [
        { name: "Open the signup page", status: "passed", durationMs: 100 },
        { name: "Fill in the form", status: "passed", durationMs: 100 },
        { name: "Submit", status: "failed", durationMs: 100, error: "locator.click: Timeout 10000ms exceeded.", url: "http://localhost:3000/signup", screenshot: `${cwd}/verify-report/screenshots/signup-03-submit.png` },
        { name: "See the welcome screen", status: "skipped", durationMs: 0 },
      ],
      consoleErrors: ["TypeError: x is undefined (at /signup:12)"],
      failedRequests: [{ method: "POST", url: "/api/signup", status: 500, statusText: "Internal Server Error", body: '{"error":"boom"}' }],
    },
    { name: "login", status: "passed", durationMs: 800, steps: [{ name: "Open", status: "passed", durationMs: 1 }], consoleErrors: [], failedRequests: [] },
  ],
};

test("a failed run reads as a prompt for the agent", () => {
  const md = renderReport(failedRun, { cwd });
  assert.match(md, /^# stillworks: 1 of 2 journeys failed/);
  assert.match(md, /The `signup` journey failed at step 3 of 4: "Submit"/);
  assert.match(md, /Steps that passed before it: 1\. Open the signup page · 2\. Fill in the form/);
  assert.match(md, /locator\.click: Timeout 10000ms exceeded\./);
  assert.match(md, /- TypeError: x is undefined \(at \/signup:12\)/);
  assert.match(md, /- POST \/api\/signup → 500 Internal Server Error\n  Response: `\{"error":"boom"\}`/);
  assert.match(md, /Screenshot: verify-report\/screenshots\/signup-03-submit\.png/);
  assert.match(md, /Fix this without changing unrelated files\./);
  assert.match(md, /keep them passing: `login`/);
  assert.match(md, /run `npx stillworks run --url http:\/\/localhost:3000`/);
  assert.match(md, /\| signup \| ❌ failed \| 2\/4 \|/);
});

test("the report footer depends on the result: gh_report_fail when something broke, gh_report when it all passed", () => {
  const failedLast = renderReport(failedRun, { cwd }).trimEnd().split("\n").at(-1);
  assert.ok(failedLast.includes(REPORT_FAIL_PROMO_URL), failedLast);
  assert.ok(REPORT_FAIL_PROMO_URL.includes("utm_source=gh_report_fail"));
  const passedLast = renderReport({ ...failedRun, journeys: [failedRun.journeys[1]] }, { cwd }).trimEnd().split("\n").at(-1);
  assert.ok(passedLast.includes(REPORT_PROMO_URL), passedLast);
  assert.ok(!passedLast.includes("gh_report_fail"), passedLast);
});

test("a passing run says so and asks for nothing", () => {
  const md = renderReport({ ...failedRun, journeys: [failedRun.journeys[1]] }, { cwd });
  assert.match(md, /^# stillworks: all 1 journey passed/);
  assert.doesNotMatch(md, /Fix this/);
});

test("promo line: on by default, off with --no-promo or NO_PUBLISHUB_PROMO", () => {
  assert.ok(CLI_PROMO.includes("https://getpublishub.com/?utm_source=gh_cli#"));
  assert.ok(CLI_FAIL_PROMO.includes("https://getpublishub.com/?utm_source=gh_cli_fail"));
  assert.equal(cliPromo(true), CLI_FAIL_PROMO);
  assert.equal(cliPromo(false), CLI_PROMO);
  assert.ok(INIT_PROMO.includes("https://getpublishub.com/?utm_source=gh_init"));
  assert.equal(shouldShowPromo(false, {}), true);
  assert.equal(shouldShowPromo(true, {}), false);
  assert.equal(shouldShowPromo(false, { NO_PUBLISHUB_PROMO: "1" }), false);
  assert.equal(shouldShowPromo(false, { NO_PUBLISHUB_PROMO: "true" }), false);
  assert.equal(shouldShowPromo(false, { NO_PUBLISHUB_PROMO: "0" }), true);
});

test("base URL: flag beats env beats config, and a bare host gets a scheme", () => {
  assert.equal(resolveBaseURL("http://a.test/", { baseURL: "http://c.test" }, { STILLWORKS_URL: "http://b.test" }), "http://a.test");
  assert.equal(resolveBaseURL(undefined, { baseURL: "http://c.test" }, { STILLWORKS_URL: "http://b.test" }), "http://b.test");
  assert.equal(resolveBaseURL(undefined, { baseURL: "http://c.test" }, {}), "http://c.test");
  assert.equal(resolveBaseURL("localhost:3000", {}, {}), "http://localhost:3000");
  assert.equal(resolveBaseURL("my-app.vercel.app", {}, {}), "https://my-app.vercel.app");
  assert.throws(() => resolveBaseURL(undefined, {}, {}), UsageError);
  assert.throws(() => resolveBaseURL("ftp://x.test", {}, {}), UsageError);
});

test("headers parse as name: value", () => {
  assert.deepEqual(parseHeaders(["X-Vercel-Protection-Bypass: abc:123"]), { "x-vercel-protection-bypass": "abc:123" });
  assert.throws(() => parseHeaders(["nope"]), UsageError);
});

test("config validation explains what's wrong", () => {
  const step = { name: "Open", run: () => {} };
  assert.ok(validateConfig({ journeys: [{ name: "a", steps: [step] }] }));
  assert.throws(() => validateConfig({}), /at least one journey/);
  assert.throws(() => validateConfig({ journeys: [{ name: "a", steps: [step] }, { name: "a", steps: [step] }] }), /unique/);
  assert.throws(() => validateConfig({ journeys: [{ name: "a", steps: [{ name: "x" }] }] }), /`run` function/);
});

test("helpers: slugs are file-safe, Playwright errors lose the noise", () => {
  assert.equal(slug("See the Welcome screen!"), "see-the-welcome-screen");
  assert.equal(slug("***"), "step");
  const error = new Error("\u001b[31mlocator.click: Timeout 10000ms exceeded.\u001b[39m\nCall log:\n  - waiting for getByRole('button')\n  - another line\n  - noise");
  assert.equal(cleanError(error), "locator.click: Timeout 10000ms exceeded.\n- waiting for getByRole('button')\n- another line");
});

test("the URL's source is named in errors, and local URLs are recognized", () => {
  assert.equal(baseURLSource("https://a.test", { STILLWORKS_URL: "x" }), "--url");
  assert.equal(baseURLSource(undefined, { STILLWORKS_URL: "https://b.test" }), "STILLWORKS_URL");
  assert.equal(baseURLSource(undefined, {}, "journeys.config.ts"), "baseURL in journeys.config.ts");
  for (const url of ["http://localhost:3000", "http://app.localhost", "http://127.0.0.1:4173", "http://[::1]:3000", "http://0.0.0.0:8080"]) assert.ok(isLocalURL(url), url);
  for (const url of ["https://linear.app", "https://my-app.vercel.app", "http://10.0.0.5"]) assert.ok(!isLocalURL(url), url);
});

test("the untouched example config is detected, even with a new baseURL or Windows line endings", () => {
  const template = readFileSync(new URL("../templates/journeys.config.ts", import.meta.url), "utf8");
  assert.ok(isExampleConfig(template, template));
  assert.ok(isExampleConfig(template.replace('"http://localhost:3000"', '"https://linear.app"'), template));
  assert.ok(isExampleConfig(template.replace(/\n/g, "\r\n"), template));
  assert.ok(!isExampleConfig(template.replace('name: "signup"', 'name: "home"'), template));
});

test("init: dev dependency uses the folder's package manager, and an existing install is reused", () => {
  const dir = mkdtempSync(join(tmpdir(), "stillworks-unit-"));
  try {
    assert.equal(addDevCommand(dir).command, "npm");
    assert.ok(!hasLocalPackage(dir));
    writeFileSync(join(dir, "pnpm-lock.yaml"), "");
    assert.deepEqual(addDevCommand(dir), { command: "pnpm", args: ["add", "-D"] });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "stillworks" }));
    assert.ok(hasLocalPackage(dir), "the stillworks repo itself counts as installed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("init next steps mention npx.cmd only on Windows", () => {
  assert.match(nextSteps("journeys.config.ts", "win32"), /npx\.cmd/);
  assert.doesNotMatch(nextSteps("journeys.config.ts", "darwin"), /npx\.cmd/);
  assert.match(nextSteps("journeys.config.ts", "linux"), /set baseURL/);
});

// A step that timed out waiting for something, with no console errors and no failed requests: the
// Invoicer case, where the page had no <a> links and the journey looked for one.
const selectorRun = {
  baseURL: "https://app.test",
  startedAt: "2026-11-21T12:00:00.000Z",
  durationMs: 20000,
  journeys: [
    {
      name: "home",
      status: "failed",
      failedStep: 2,
      durationMs: 20000,
      steps: [
        { name: "Open the home page", status: "passed", durationMs: 100 },
        { name: "See a heading", status: "passed", durationMs: 100 },
        { name: "See at least one link", status: "failed", durationMs: 15000, error: "locator.waitFor: Timeout 15000ms exceeded.\n- waiting for getByRole('link').first() to be visible", url: "https://app.test/" },
      ],
      consoleErrors: [],
      failedRequests: [],
    },
  ],
};

test("a timeout with no errors on the page points at the journey, not the app", () => {
  assert.ok(looksLikeJourneyProblem(selectorRun.journeys[0]));
  assert.ok(!looksLikeJourneyProblem(failedRun.journeys[0]), "console errors and a 500 mean a real bug");
  const md = renderReport(selectorRun, { cwd });
  assert.match(md, /this may be the journey rather than the app/);
  assert.match(md, /Open the screenshot first\./);
  assert.doesNotMatch(md, /don't change the journey/);
  // A real bug keeps the strict instruction.
  assert.match(renderReport(failedRun, { cwd }), /don't change the journey or weaken the check/);
  assert.doesNotMatch(renderReport(failedRun, { cwd }), /may be the journey rather than the app/);
});

test("a passing report suggests the README badge, unless promo is off", () => {
  const passing = { ...failedRun, journeys: [failedRun.journeys[1]] };
  assert.ok(renderReport(passing, { cwd }).includes(BADGE_MARKDOWN));
  assert.ok(!renderReport(passing, { cwd, badge: false }).includes(BADGE_MARKDOWN));
  assert.ok(!renderReport(failedRun, { cwd }).includes(BADGE_MARKDOWN), "no badge when something failed");
  assert.match(BADGE_MARKDOWN, /tested%20with-stillworks/);
  assert.doesNotMatch(BADGE_MARKDOWN, /passing/, "a static badge must not claim a live result");
});

test("syntax errors in the config name the line, on Linux and on Windows", () => {
  const linux = loadErrorMessage("journeys.config.ts", 'ParseError: Unexpected token, expected ","  \n /home/me/app/journeys.config.ts:5:2');
  assert.equal(linux, 'journeys.config.ts has a syntax error at line 5, column 2 (Unexpected token, expected ","). Usually a missing or extra bracket, comma or quote on or just before that line.');
  const windows = loadErrorMessage("journeys.config.ts", "ParseError: C:\\: Unexpected token \n C:/Users/me/teste/journeys.config.ts:24:4");
  assert.match(windows, /^journeys\.config\.ts has a syntax error at line 24, column 4 \(Unexpected token\)\./);
  assert.doesNotMatch(windows, /C:/);
  assert.equal(loadErrorMessage("journeys.config.ts", "Cannot find module 'x'"), "Couldn't load journeys.config.ts: Cannot find module 'x'");
});

test("check picks same-origin pages, key ones first, and never links that change data", () => {
  const start = new URL("https://app.example.com/");
  const links = [
    { path: "https://app.example.com/blog", text: "Blog" },
    { path: "https://app.example.com/pricing", text: "Pricing" },
    { path: "https://app.example.com/logout", text: "Log out" },
    { path: "https://app.example.com/settings/delete-account", text: "Delete account" },
    { path: "https://other.example.com/signup", text: "Sign up elsewhere" },
    { path: "https://app.example.com/#features", text: "Features" },
    { path: "https://app.example.com/auth", text: "Sign in" },
    { path: "https://app.example.com/pricing", text: "Pricing again" },
    { path: "https://app.example.com/terms.pdf", text: "Terms" },
    { path: "mailto:hi@example.com", text: "Email" },
  ];
  assert.deepEqual(pickPages(links, start, 6), ["/pricing", "/auth", "/blog"]);
  assert.deepEqual(pickPages(links, start, 1), ["/pricing"]);
});

test("check spots SPA not-found screens and blank pages, not normal ones", () => {
  assert.match(looksLikeErrorScreen("My app", "404", "404 Oops! Page not found"), /not found/);
  assert.match(looksLikeErrorScreen("Page Not Found", "", "Go home"), /not found/);
  assert.match(looksLikeErrorScreen("My app", "", "   "), /blank/);
  assert.equal(looksLikeErrorScreen("Pricing · My app", "Simple pricing", "Pro plan $19/month"), undefined);
});

test("check builds one read-only journey per page", () => {
  const config = smokeConfig("/", ["/pricing", "/auth"], 5000);
  assert.deepEqual(config.journeys.map((j) => j.name), ["home", "/pricing", "/auth"]);
  assert.deepEqual(config.journeys[1].steps.map((s) => s.name), ["Open /pricing", "Show the page, not an error screen", "No JavaScript crash", "No server errors from your app"]);
  assert.equal(config.timeout, 5000);
  assert.equal(smokeConfig("/app", []).journeys[0].name, "/app");
});

test("init suggests a prompt so the agent writes the journeys", () => {
  const text = nextSteps("journeys.config.ts", "linux");
  assert.match(text, /Paste this/);
  assert.match(text, /Read journeys\.config\.ts and my app's routes/);
  assert.match(text, /npx stillworks check/);
});

test("hosted mode: private, loopback, link-local and mapped addresses are never public", async () => {
  const { isPrivateAddress, isPublicHost } = await import("../dist/netguard.js");
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fc00::1", "fd12::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "64:ff9b::10.0.0.1", "not-an-ip"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "104.18.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
  for (const host of ["localhost", "app.localhost", "metadata.google.internal", "printer.local", "127.0.0.1", "[::1]"]) {
    assert.equal(await isPublicHost(host), false, host);
  }
});

test("the Claude Code plugin stays in sync with the package", () => {
  const root = new URL("..", import.meta.url);
  const read = (path) => readFileSync(new URL(path, root), "utf8");
  const pkg = JSON.parse(read("package.json"));
  const plugin = JSON.parse(read("integrations/claude-code-plugin/.claude-plugin/plugin.json"));
  assert.equal(plugin.version, pkg.version, "bump integrations/claude-code-plugin/.claude-plugin/plugin.json with package.json");
  assert.equal(
    read("integrations/claude-code-plugin/commands/verify.md"),
    read("integrations/claude-code/commands/verify.md"),
    "the plugin's /verify and the one init --claude copies must be the same file",
  );
  const marketplace = JSON.parse(read(".claude-plugin/marketplace.json"));
  assert.equal(marketplace.plugins[0].source, "./integrations/claude-code-plugin");
});
