import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Browser, Page } from "playwright";
import { UsageError, type Config, type Journey } from "./config.js";

export interface FailedRequest {
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  /** Network error, when there was no response at all. */
  failure?: string;
  /** Start of the response body, for your own origin only. */
  body?: string;
}

export interface StepResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  error?: string;
  /** Absolute path. */
  screenshot?: string;
  url?: string;
}

export interface JourneyResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  steps: StepResult[];
  /** Index of the step that failed. */
  failedStep?: number;
  /** Why the journey failed when no step did (failOnConsoleErrors). */
  reason?: string;
  consoleErrors: string[];
  failedRequests: FailedRequest[];
  durationMs: number;
}

export interface RunResult {
  baseURL: string;
  startedAt: string;
  durationMs: number;
  journeys: JourneyResult[];
}

export interface RunOptions {
  baseURL: string;
  outDir: string;
  headed?: boolean;
  /** Overrides config.timeout. */
  timeout?: number;
  /** Only run these journeys (by name). */
  only?: string[];
  /** A browser you already have instead of Playwright's Chromium: "chrome" or "msedge". */
  channel?: string;
  /** Merged over config.headers. */
  headers?: Record<string, string>;
  onJourneyStart?: (journey: Journey) => void;
  onJourneyEnd?: (result: JourneyResult) => void;
}

const DEFAULT_IGNORED_REQUESTS: Array<string | RegExp> = [/\/favicon\.ico(\?|$)/];

export async function runJourneys(config: Config, options: RunOptions): Promise<RunResult> {
  const startedAt = new Date();
  const outDir = resolve(options.outDir);
  const shotsDir = join(outDir, "screenshots");
  prepareOutDir(outDir);
  mkdirSync(shotsDir, { recursive: true });

  let journeys = config.journeys;
  if (options.only?.length) {
    const unknown = options.only.filter((name) => !journeys.some((j) => j.name === name));
    if (unknown.length) {
      throw new UsageError(`No journey called ${unknown.map((n) => `"${n}"`).join(", ")}. Journeys: ${journeys.map((j) => j.name).join(", ")}`);
    }
    journeys = journeys.filter((j) => options.only!.includes(j.name));
  }

  const browser = await launch(options);
  const results: JourneyResult[] = [];
  try {
    for (const journey of journeys) {
      if (journey.skip) {
        const skipped: JourneyResult = { name: journey.name, status: "skipped", steps: [], consoleErrors: [], failedRequests: [], durationMs: 0 };
        results.push(skipped);
        options.onJourneyEnd?.(skipped);
        continue;
      }
      options.onJourneyStart?.(journey);
      const result = await runJourney(browser, journey, config, options, shotsDir);
      results.push(result);
      options.onJourneyEnd?.(result);
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return { baseURL: options.baseURL, startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime(), journeys: results };
}

/** Clears only what a previous run wrote, so `--out .` can never wipe a project. */
function prepareOutDir(outDir: string) {
  mkdirSync(outDir, { recursive: true });
  for (const name of ["screenshots", "REPORT.md", "report.json"]) {
    rmSync(join(outDir, name), { recursive: true, force: true });
  }
}

async function launch(options: RunOptions): Promise<Browser> {
  const { chromium } = await import("playwright");
  try {
    return await chromium.launch({ headless: !options.headed, channel: options.channel });
  } catch (error) {
    const message = stripAnsi(String((error as Error).message));
    if (/Executable doesn't exist|playwright install/i.test(message)) {
      throw new UsageError(
        options.channel
          ? `Couldn't start ${options.channel}. Is it installed? Or drop --channel and run: npx stillworks install`
          : "The browser isn't installed yet. Run: npx stillworks install",
      );
    }
    throw error;
  }
}

async function runJourney(browser: Browser, journey: Journey, config: Config, options: RunOptions, shotsDir: string): Promise<JourneyResult> {
  const started = Date.now();
  const baseURL = options.baseURL;
  const origin = new URL(baseURL).origin;
  const timeout = options.timeout ?? config.timeout ?? 10_000;
  const stepTimeout = Math.max(60_000, timeout * 6);
  const headers = { ...config.headers, ...options.headers };
  const ignoredRequests = [...DEFAULT_IGNORED_REQUESTS, ...(config.ignoreRequests ?? [])];
  const consoleErrors: string[] = [];
  const failedRequests: FailedRequest[] = [];
  const bodies: Promise<unknown>[] = [];

  const context = await browser.newContext({ baseURL, viewport: config.viewport ?? { width: 1280, height: 800 } });
  if (Object.keys(headers).length) {
    // Only your own origin gets the headers, so a bypass secret never reaches third parties.
    await context.route("**/*", (route) => {
      const request = route.request();
      if (sameOrigin(request.url(), origin)) return route.continue({ headers: { ...request.headers(), ...headers } });
      return route.continue();
    });
  }
  const page = await context.newPage();
  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout * 3);

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // The browser's own "Failed to load resource" lines duplicate what failedRequests already has.
    if (text.startsWith("Failed to load resource")) return;
    if (matches(text, config.ignoreConsole)) return;
    const { url, lineNumber } = message.location();
    consoleErrors.push(url ? `${text} (at ${shortUrl(url, origin)}${lineNumber ? `:${lineNumber + 1}` : ""})` : text);
  });
  page.on("pageerror", (error) => {
    if (!matches(error.message, config.ignoreConsole)) consoleErrors.push(`Uncaught ${error.name}: ${error.message}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (status < 400 || matches(url, ignoredRequests)) return;
    const entry: FailedRequest = { method: response.request().method(), url: shortUrl(url, origin), status, statusText: response.statusText() };
    failedRequests.push(entry);
    if (sameOrigin(url, origin)) {
      bodies.push(response.text().then((text) => { if (text.trim()) entry.body = truncate(text.trim(), 600); }, () => {}));
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "request failed";
    if (failure.includes("ERR_ABORTED") || matches(request.url(), ignoredRequests)) return;
    failedRequests.push({ method: request.method(), url: shortUrl(request.url(), origin), failure });
  });

  const steps: StepResult[] = journey.steps.map((step) => ({ name: step.name, status: "skipped", durationMs: 0 }));
  let failedStep: number | undefined;
  for (let i = 0; i < journey.steps.length; i++) {
    const step = journey.steps[i];
    const t = Date.now();
    try {
      await withTimeout(Promise.resolve().then(() => step.run({ page, context, baseURL })), stepTimeout, `The step didn't finish within ${stepTimeout / 1000}s.`);
      steps[i].status = "passed";
    } catch (error) {
      steps[i].status = "failed";
      steps[i].error = cleanError(error);
      failedStep = i;
    }
    steps[i].durationMs = Date.now() - t;
    steps[i].url = safeUrl(page);
    steps[i].screenshot = await screenshot(page, join(shotsDir, `${slug(journey.name)}-${String(i + 1).padStart(2, "0")}-${slug(step.name)}.png`));
    if (failedStep !== undefined) break;
  }

  await Promise.race([Promise.all(bodies), new Promise((r) => setTimeout(r, 2000))]);
  await context.close().catch(() => {});

  let status: JourneyResult["status"] = failedStep === undefined ? "passed" : "failed";
  let reason: string | undefined;
  if (status === "passed" && config.failOnConsoleErrors && consoleErrors.length) {
    status = "failed";
    reason = "Every step passed, but the page logged console errors (failOnConsoleErrors is on).";
  }
  return { name: journey.name, status, steps, failedStep, reason, consoleErrors, failedRequests, durationMs: Date.now() - started };
}

async function screenshot(page: Page, file: string): Promise<string | undefined> {
  try {
    await page.screenshot({ path: file, timeout: 5000 });
    return file;
  } catch {
    return undefined;
  }
}

function safeUrl(page: Page) {
  try {
    return page.url();
  } catch {
    return undefined;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function cleanError(error: unknown): string {
  let message = stripAnsi(error instanceof Error ? error.message : String(error));
  const callLog = message.indexOf("\nCall log:");
  if (callLog > -1) {
    // Keep the first line or two of Playwright's call log: it says what it was waiting for.
    const tail = message.slice(callLog).split("\n").slice(2, 4).map((l) => l.trim()).filter(Boolean);
    message = message.slice(0, callLog).trim() + (tail.length ? `\n${tail.join("\n")}` : "");
  }
  return truncate(message.trim(), 1200);
}

export function slug(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "step";
}

const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;]*m/g, "");
const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

function matches(text: string, patterns: Array<string | RegExp> | undefined) {
  return (patterns ?? []).some((p) => (typeof p === "string" ? text.includes(p) : p.test(text)));
}

function sameOrigin(url: string, origin: string) {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

function shortUrl(url: string, origin: string) {
  return url.startsWith(`${origin}/`) ? url.slice(origin.length) : url;
}
