import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { baseURLSource, isLocalURL, parseHeaders, resolveBaseURL } from "../dist/args.js";
import { UsageError, isExampleConfig, validateConfig } from "../dist/config.js";
import { addDevCommand, hasLocalPackage, nextSteps } from "../dist/setup.js";
import { CLI_PROMO, INIT_PROMO, REPORT_PROMO_URL, shouldShowPromo } from "../dist/promo.js";
import { renderReport } from "../dist/report.js";
import { cleanError, slug } from "../dist/runner.js";

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

test("the report ends with the gh_report footer", () => {
  const md = renderReport(failedRun, { cwd }).trimEnd();
  const last = md.split("\n").at(-1);
  assert.ok(last.includes(REPORT_PROMO_URL), last);
  assert.ok(REPORT_PROMO_URL.includes("utm_source=gh_report"));
});

test("a passing run says so and asks for nothing", () => {
  const md = renderReport({ ...failedRun, journeys: [failedRun.journeys[1]] }, { cwd });
  assert.match(md, /^# stillworks: all 1 journey passed/);
  assert.doesNotMatch(md, /Fix this/);
});

test("promo line: on by default, off with --no-promo or NO_PUBLISHUB_PROMO", () => {
  assert.ok(CLI_PROMO.includes("https://getpublishub.com/?utm_source=gh_cli"));
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
