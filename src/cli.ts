#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { baseURLSource, isLocalURL, parseHeaders, resolveBaseURL } from "./args.js";
import { DEFAULT_CONFIG_FILE, UsageError, isExampleConfig, loadConfig } from "./config.js";
import { INIT_PROMO, cliPromo, shouldShowPromo } from "./promo.js";
import { looksLikeJourneyProblem, toReportPath, writeReport } from "./report.js";
import { runJourneys, type JourneyResult } from "./runner.js";
import { serveMcp } from "./mcp.js";
import { serveMcpHttp } from "./mcp-http.js";
import { MAX_EXTRA_PAGES, discover, pickPages, smokeConfig } from "./smoke.js";
import { INTEGRATIONS, PACKAGE_ROOT, init, installBrowser, nextSteps, type Integration } from "./setup.js";

const HELP = `stillworks: your AI writes the code, this checks it still works.

Usage
  npx stillworks check <url>                             zero setup: open your app and its key pages, read-only
  npx stillworks init [--claude] [--cursor] [--github]   create journeys.config.ts and install Chromium
  npx stillworks run --url <url>                         run every journey in a real browser
  npx stillworks install [--with-deps]                   install (or update) Chromium
  npx stillworks hook claude-code                        for a Claude Code Stop hook (see README)
  npx stillworks mcp                                     an MCP server: your agent calls check_app / run_journeys itself
  npx stillworks mcp --http [--port 8787]                the same server over HTTP, for clients that connect to a URL

Options for run
  -u, --url <url>         the app to check (or STILLWORKS_URL, or baseURL in the config)
  -c, --config <file>     default: ${DEFAULT_CONFIG_FILE}
  -o, --out <dir>         where REPORT.md and screenshots go (default: verify-report)
  -j, --journey <name>    only run this journey (repeatable)
  -H, --header "k: v"     send a header to your app's origin only (repeatable)
      --timeout <ms>      max time per action (default: 10000)
      --channel <name>    use an installed browser instead: chrome or msedge
      --headed            show the browser
      --no-promo          hide the one-line Publishub note (or NO_PUBLISHUB_PROMO=1)

Options for check
  -o, --out <dir>, -H, --header, --timeout, --channel, --headed, --no-promo   same as run
  check only opens pages: it never fills a form, clicks a button or opens links like "log out"

Options for init
      --claude --cursor --github   also add the Claude Code command, Cursor rule or GitHub Action
      --skip-install               don't install anything (the stillworks package or Chromium)
      --force                      overwrite files that already exist
      --no-promo                   hide the one-line Publishub note (or NO_PUBLISHUB_PROMO=1)

Options for mcp --http
      --port <n>          default: $PORT or 8787
      --host <addr>       default: 127.0.0.1 (0.0.0.0 with --hosted)
      --hosted            a public server (Lovable, Bolt, Replit…): check_app only, public URLs only,
                          private networks blocked, a rate limit per client
      --trust-proxy       read the client address from X-Forwarded-For (behind Fly, Render, Railway…)
  STILLWORKS_MCP_TOKEN    require "Authorization: Bearer <token>"
  STILLWORKS_RATE_LIMIT   checks per client per hour with --hosted (default 20)

Exit codes: 0 every journey passed · 1 a journey failed · 2 usage or setup problem`;

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code: string) => (text: string) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);
const green = paint("32");
const red = paint("31");
const dim = paint("2");
const bold = paint("1");

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      url: { type: "string", short: "u" },
      config: { type: "string", short: "c" },
      out: { type: "string", short: "o" },
      journey: { type: "string", short: "j", multiple: true },
      header: { type: "string", short: "H", multiple: true },
      timeout: { type: "string" },
      channel: { type: "string" },
      headed: { type: "boolean" },
      "no-promo": { type: "boolean" },
      claude: { type: "boolean" },
      cursor: { type: "boolean" },
      github: { type: "boolean" },
      "skip-install": { type: "boolean" },
      force: { type: "boolean" },
      "with-deps": { type: "boolean" },
      http: { type: "boolean" },
      hosted: { type: "boolean" },
      port: { type: "string" },
      host: { type: "string" },
      "trust-proxy": { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
  const [command, ...rest] = positionals;

  if (values.version) {
    console.log(JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")).version);
    return 0;
  }
  if (values.help || !command || command === "help") {
    console.log(HELP);
    return command || values.help ? 0 : 2;
  }

  if (command === "init") {
    const integrations = (Object.keys(INTEGRATIONS) as Integration[]).filter((key) => values[key]);
    await init({ config: values.config, force: values.force, skipInstall: values["skip-install"], integrations });
    console.log(`\n${nextSteps(values.config ?? DEFAULT_CONFIG_FILE)}`);
    if (shouldShowPromo(values["no-promo"])) console.log(`\n${dim(INIT_PROMO)}`);
    return 0;
  }

  if (command === "mcp") {
    if (!values.http) {
      if (values.hosted) throw new UsageError("--hosted only works with --http: npx stillworks mcp --http --hosted");
      return serveMcp();
    }
    const port = Number(values.port ?? process.env.PORT ?? 8787);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new UsageError(`--port needs a number from 0 to 65535, got "${values.port}".`);
    const rateLimit = Number(process.env.STILLWORKS_RATE_LIMIT ?? 20);
    return serveMcpHttp({
      port,
      host: values.host ?? (values.hosted ? "0.0.0.0" : "127.0.0.1"),
      hosted: values.hosted,
      trustProxy: values["trust-proxy"],
      rateLimit: Number.isFinite(rateLimit) && rateLimit > 0 ? rateLimit : 20,
      token: process.env.STILLWORKS_MCP_TOKEN?.trim() || undefined,
    });
  }

  if (command === "install") {
    await installBrowser({ withDeps: values["with-deps"] });
    return 0;
  }

  const run = {
    url: values.url,
    configFile: values.config ?? DEFAULT_CONFIG_FILE,
    outDir: values.out ?? "verify-report",
    only: values.journey,
    headers: parseHeaders(values.header ?? []),
    timeout: values.timeout === undefined ? undefined : positiveNumber(values.timeout, "--timeout"),
    channel: values.channel ?? process.env.STILLWORKS_CHANNEL,
    headed: values.headed,
    promo: shouldShowPromo(values["no-promo"]),
  };

  if (command === "check") {
    const target = rest[0] ?? values.url;
    if (!target) throw new UsageError("Which app should I check? Run: npx stillworks check https://your-app.com (or http://localhost:3000)");
    const outcome = await quickCheck(target, run);
    if (shouldShowPromo(values["no-promo"])) console.log(`\n${dim(cliPromo(Boolean(outcome.failed)))}`);
    return outcome.failed ? 1 : 0;
  }

  if (command === "run") {
    const outcome = await check(run, { quiet: false });
    if (shouldShowPromo(values["no-promo"])) console.log(`\n${dim(cliPromo(Boolean(outcome.failed)))}`);
    return outcome.failed ? 1 : 0;
  }

  if (command === "hook") {
    if (rest[0] !== "claude-code") throw new UsageError("Usage: npx stillworks hook claude-code");
    return claudeCodeHook(run);
  }

  throw new UsageError(`Unknown command "${command}". Run: npx stillworks --help`);
}

interface CheckInput {
  url?: string;
  configFile: string;
  outDir: string;
  only?: string[];
  headers: Record<string, string>;
  timeout?: number;
  channel?: string;
  headed?: boolean;
  promo?: boolean;
}

async function check(input: CheckInput, { quiet }: { quiet: boolean }) {
  const { config, path } = await loadConfig(input.configFile);
  const baseURL = resolveBaseURL(input.url, config);
  const template = readFileSync(join(PACKAGE_ROOT, "templates", "journeys.config.ts"), "utf8");
  if (!isLocalURL(baseURL) && isExampleConfig(readFileSync(path, "utf8"), template)) {
    throw new UsageError(
      `${input.configFile} still has the example journeys (signup, login, checkout). They create accounts and submit forms, ` +
        `so they won't run against ${new URL(baseURL).host}. Change them to match your app first.`,
    );
  }
  await assertReachable(baseURL, baseURLSource(input.url, process.env, input.configFile));
  const print = quiet ? () => {} : (line: string) => console.log(line);
  const count = config.journeys.filter((j) => !j.skip && (!input.only?.length || input.only.includes(j.name))).length;
  print(`${bold("stillworks")} ${dim("·")} checking ${baseURL} ${dim(`· ${count} ${count === 1 ? "journey" : "journeys"}`)}\n`);

  const width = Math.max(...config.journeys.map((j) => j.name.length));
  const live = !quiet && Boolean(process.stdout.isTTY);
  const result = await runJourneys(config, {
    baseURL,
    outDir: input.outDir,
    only: input.only,
    headers: input.headers,
    timeout: input.timeout,
    channel: input.channel,
    headed: input.headed,
    onJourneyStart: (journey) => {
      if (live) process.stdout.write(dim(`  … ${journey.name}`));
    },
    onJourneyEnd: (journey) => {
      if (live) process.stdout.write("\r\u001b[2K");
      for (const line of journeyLines(journey, width)) print(line);
    },
  });

  const rerun = [
    "npx stillworks run",
    input.url ? `--url ${baseURL}` : "",
    input.configFile !== DEFAULT_CONFIG_FILE ? `--config ${input.configFile}` : "",
    input.outDir !== "verify-report" ? `--out ${input.outDir}` : "",
  ].filter(Boolean).join(" ");
  const paths = writeReport(result, input.outDir, { rerun, badge: input.promo !== false });
  const failed = result.journeys.filter((j) => j.status === "failed").length;
  const ran = result.journeys.filter((j) => j.status !== "skipped").length;
  const report = toReportPath(paths.markdown, process.cwd());

  print("");
  if (failed) {
    print(`${red(bold(`${failed} of ${ran} ${ran === 1 ? "journey" : "journeys"} failed`))} ${dim(`· ${(result.durationMs / 1000).toFixed(1)}s`)}`);
    print(`Paste this into your agent: ${bold(report)}`);
  } else {
    print(`${green(bold(`All ${ran} ${ran === 1 ? "journey" : "journeys"} passed`))} ${dim(`· ${(result.durationMs / 1000).toFixed(1)}s`)}`);
    print(dim(`Report and screenshots: ${report}`));
  }
  return { result, failed, report: paths.markdown };
}

/**
 * `check <url>`: no config. Opens the URL, picks the key pages linked from it, and runs a read-only journey for
 * each one (the page loads, isn't an error screen, no JavaScript crash, no 5xx from your app). Same report.
 */
async function quickCheck(target: string, input: CheckInput) {
  const url = resolveBaseURL(target, {});
  await assertReachable(url, "the URL you passed");
  console.log(`${bold("stillworks check")} ${dim("·")} ${url} ${dim("· read-only, nothing is clicked or submitted")}\n`);
  console.log(dim(`  … finding your app's key pages`));

  const { finalURL, links } = await discover(url, { channel: input.channel, headed: input.headed, headers: input.headers, timeout: input.timeout });
  const startPath = `${finalURL.pathname}${finalURL.search}` || "/";
  const pages = pickPages(links, finalURL, MAX_EXTRA_PAGES);
  const config = smokeConfig(startPath, pages, input.timeout);
  if (process.stdout.isTTY) process.stdout.write("\u001b[1A\r\u001b[2K");
  console.log(dim(`  ${pages.length ? `${1 + pages.length} pages: ${[startPath, ...pages].join("  ")}` : `1 page: ${startPath} (no other pages linked from it)`}\n`));

  const width = Math.max(...config.journeys.map((j) => j.name.length));
  const live = Boolean(process.stdout.isTTY);
  const result = await runJourneys(config, {
    baseURL: finalURL.origin,
    outDir: input.outDir,
    headers: input.headers,
    timeout: input.timeout,
    channel: input.channel,
    headed: input.headed,
    onJourneyStart: (journey) => {
      if (live) process.stdout.write(dim(`  … ${journey.name}`));
    },
    onJourneyEnd: (journey) => {
      if (live) process.stdout.write("\r\u001b[2K");
      for (const line of journeyLines(journey, width)) console.log(line);
    },
  });

  const rerun = ["npx stillworks check", url, input.outDir !== "verify-report" ? `--out ${input.outDir}` : ""].filter(Boolean).join(" ");
  // the badge says "tested with stillworks": only for real journeys, not for this first look
  const paths = writeReport(result, input.outDir, { rerun, badge: false });
  const failed = result.journeys.filter((j) => j.status === "failed").length;
  const ran = result.journeys.length;
  const report = toReportPath(paths.markdown, process.cwd());

  console.log("");
  if (failed) {
    console.log(`${red(bold(`${failed} of ${ran} ${ran === 1 ? "page has" : "pages have"} a problem`))} ${dim(`· ${(result.durationMs / 1000).toFixed(1)}s`)}`);
    console.log(`Paste this into your agent: ${bold(report)}`);
  } else {
    console.log(`${green(bold(`All ${ran} ${ran === 1 ? "page" : "pages"} look fine`))} ${dim(`· ${(result.durationMs / 1000).toFixed(1)}s`)}`);
    console.log(dim(`Report and screenshots: ${report}`));
  }
  console.log(`\nThis looked at pages only. To check the flows behind them (signup, login, checkout): ${bold("npx stillworks init")}`);
  return { failed };
}

function journeyLines(journey: JourneyResult, width: number): string[] {
  const name = journey.name.padEnd(width);
  const time = dim(`${(journey.durationMs / 1000).toFixed(1)}s`);
  if (journey.status === "skipped") return [`  ${dim("-")} ${dim(name)}  ${dim("skipped")}`];
  if (journey.status === "passed") return [`  ${green("✓")} ${name}  ${dim(`${journey.steps.length} steps ·`)} ${time}`];
  const lines: string[] = [];
  const index = journey.failedStep;
  if (index !== undefined) {
    const step = journey.steps[index];
    lines.push(`  ${red("✗")} ${name}  failed at step ${index + 1}/${journey.steps.length}: "${step.name}" ${dim("·")} ${time}`);
    if (step.error) lines.push(dim(`      ${step.error.split("\n")[0]}`));
  } else {
    lines.push(`  ${red("✗")} ${name}  ${journey.reason ?? "failed"}`);
  }
  const extra: string[] = [];
  if (journey.consoleErrors.length) extra.push(`${journey.consoleErrors.length} console ${journey.consoleErrors.length === 1 ? "error" : "errors"}`);
  const firstRequest = journey.failedRequests[0];
  if (firstRequest) {
    const more = journey.failedRequests.length > 1 ? ` +${journey.failedRequests.length - 1} more` : "";
    extra.push(`${firstRequest.method} ${firstRequest.url} → ${firstRequest.status ?? firstRequest.failure}${more}`);
  }
  if (extra.length) lines.push(dim(`      ${extra.join(" · ")}`));
  else if (looksLikeJourneyProblem(journey)) lines.push(dim("      no errors on the page: check the screenshot, the step's selector may not match"));
  return lines;
}

/**
 * For a Claude Code Stop hook: when the agent finishes, run the journeys. If one broke, exit 2 so
 * Claude Code hands REPORT.md back to the agent and it keeps working. Skips quietly when nothing
 * changed since the last check, when the app isn't running, or when it's already fixing a failure.
 */
async function claudeCodeHook(input: CheckInput): Promise<number> {
  const event = await readStdinJson();
  if (event?.stop_hook_active) return 0;
  if (!existsSync(resolve(input.configFile))) return 0;

  const stateFile = join(resolve(input.outDir), ".hook-state");
  const fingerprint = workingTreeFingerprint();
  if (fingerprint && existsSync(stateFile) && readFileSync(stateFile, "utf8").trim() === fingerprint) return 0;

  try {
    const { failed, report } = await check(input, { quiet: true });
    if (fingerprint) writeFileSync(stateFile, fingerprint);
    if (!failed) return 0;
    process.stderr.write(`stillworks: a user journey broke after your changes. Fix it before you finish.\n\n${readFileSync(report, "utf8")}`);
    return 2;
  } catch (error) {
    // Never block the agent because of setup: an app that isn't running, a missing browser, a bad config.
    process.stderr.write(`stillworks: skipped (${(error as Error).message})\n`);
    return 0;
  }
}

async function readStdinJson(): Promise<Record<string, unknown> | undefined> {
  if (process.stdin.isTTY) return undefined;
  const text = await new Promise<string>((done) => {
    let data = "";
    const timer = setTimeout(() => done(data), 1000);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => {
      clearTimeout(timer);
      done(data);
    });
  });
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function workingTreeFingerprint(): string | undefined {
  try {
    const git = (args: string[]) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
    const hash = createHash("sha256").update(git(["diff", "--no-ext-diff"])).update(git(["diff", "--cached", "--no-ext-diff"]));
    // New files don't show in a diff, so track their size and modified time (works before the first commit too).
    for (const file of git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\u0000").filter(Boolean).slice(0, 5000)) {
      try {
        const { size, mtimeMs } = statSync(file);
        hash.update(`${file}:${size}:${mtimeMs}
`);
      } catch {
        hash.update(`${file}:gone
`);
      }
    }
    return hash.digest("hex");
  } catch {
    return undefined;
  }
}

async function assertReachable(baseURL: string, source: string) {
  try {
    await fetch(baseURL, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new UsageError(
      `Couldn't reach ${baseURL} (from ${source}). Is the app running? To check another address: npx stillworks run --url https://your-app.com`,
    );
  }
}

function positiveNumber(value: string, flag: string) {
  const n = Number(value);
  if (!(n > 0)) throw new UsageError(`${flag} must be a positive number.`);
  return n;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    const usage = error instanceof UsageError || String((error as { code?: string }).code ?? "").startsWith("ERR_PARSE_ARGS");
    console.error(usage ? `${red("stillworks:")} ${(error as Error).message}` : error);
    process.exit(2);
  },
);
