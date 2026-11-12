#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseHeaders, resolveBaseURL } from "./args.js";
import { DEFAULT_CONFIG_FILE, UsageError, loadConfig } from "./config.js";
import { CLI_PROMO, shouldShowPromo } from "./promo.js";
import { toReportPath, writeReport } from "./report.js";
import { runJourneys, type JourneyResult } from "./runner.js";
import { INTEGRATIONS, PACKAGE_ROOT, init, installBrowser, type Integration } from "./setup.js";

const HELP = `stillworks: your AI writes the code, this checks it still works.

Usage
  npx stillworks init [--claude] [--cursor] [--github]   create journeys.config.ts and install Chromium
  npx stillworks run --url <url>                         run every journey in a real browser
  npx stillworks install [--with-deps]                   install (or update) Chromium
  npx stillworks hook claude-code                        for a Claude Code Stop hook (see README)

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

Options for init
      --claude --cursor --github   also add the Claude Code command, Cursor rule or GitHub Action
      --skip-install               don't download Chromium
      --force                      overwrite files that already exist

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
    console.log(`\nNext:\n  1. Edit ${values.config ?? DEFAULT_CONFIG_FILE} so the selectors match your app.\n  2. npx stillworks run --url http://localhost:3000`);
    return 0;
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
  };

  if (command === "run") {
    const outcome = await check(run, { quiet: false });
    if (shouldShowPromo(values["no-promo"])) console.log(`\n${dim(CLI_PROMO)}`);
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
}

async function check(input: CheckInput, { quiet }: { quiet: boolean }) {
  const { config } = await loadConfig(input.configFile);
  const baseURL = resolveBaseURL(input.url, config);
  await assertReachable(baseURL);
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
  const paths = writeReport(result, input.outDir, { rerun });
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

async function assertReachable(baseURL: string) {
  try {
    await fetch(baseURL, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new UsageError(`Couldn't reach ${baseURL}. Is the app running?`);
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
