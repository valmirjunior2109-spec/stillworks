import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserContext, Page } from "playwright";

export interface StepContext {
  /** The Playwright page for this journey. Every journey starts in a fresh browser context (no shared cookies). */
  page: Page;
  context: BrowserContext;
  /** The URL being checked (from --url, STILLWORKS_URL or the config). */
  baseURL: string;
}

export interface Step {
  /** Shown in the terminal and in REPORT.md. Write it the way you'd describe it to a person. */
  name: string;
  run: (ctx: StepContext) => unknown | Promise<unknown>;
}

export interface Journey {
  name: string;
  steps: Step[];
  /** Skip this journey without deleting it. */
  skip?: boolean;
}

export interface Config {
  /** Overridden by --url or STILLWORKS_URL. */
  baseURL?: string;
  journeys: Journey[];
  /** Max time for each Playwright action or wait, in ms. Default 10000. */
  timeout?: number;
  /** Fail a journey when the page logs a console error or throws, even if every step passed. Default false. */
  failOnConsoleErrors?: boolean;
  /** Console errors to ignore (substring or RegExp). */
  ignoreConsole?: Array<string | RegExp>;
  /** Request URLs to ignore when collecting failed requests (substring or RegExp). */
  ignoreRequests?: Array<string | RegExp>;
  /** Headers sent only to your app's own origin, e.g. a Vercel protection bypass. */
  headers?: Record<string, string>;
  viewport?: { width: number; height: number };
}

/** Gives you types and autocomplete in journeys.config.ts. It returns the config unchanged. */
export const defineConfig = (config: Config): Config => config;

/** A problem with how stillworks was called or configured (exit code 2), not a broken journey. */
export class UsageError extends Error {}

export const DEFAULT_CONFIG_FILE = "journeys.config.ts";

export async function loadConfig(file = DEFAULT_CONFIG_FILE): Promise<{ config: Config; path: string }> {
  const path = resolve(file);
  if (!existsSync(path)) throw new UsageError(`Couldn't find ${file}. Create one with: npx stillworks init`);
  const { createJiti } = await import("jiti");
  // `import { defineConfig } from "stillworks"` works even when stillworks runs through npx and isn't installed.
  const self = fileURLToPath(new URL("./index.js", import.meta.url));
  const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false, alias: { stillworks: self } });
  let mod: unknown;
  try {
    mod = await jiti.import(path, { default: true });
  } catch (error) {
    throw new UsageError(`Couldn't load ${file}: ${(error as Error).message}`);
  }
  return { config: validateConfig(mod, file), path };
}

export function validateConfig(value: unknown, file = DEFAULT_CONFIG_FILE): Config {
  const fail = (why: string): never => {
    throw new UsageError(`${file}: ${why}`);
  };
  if (!value || typeof value !== "object") fail("export a config with `export default defineConfig({ journeys: [...] })`.");
  const config = value as Config;
  if (!Array.isArray(config.journeys) || config.journeys.length === 0) fail("add at least one journey to `journeys`.");
  const seen = new Set<string>();
  config.journeys.forEach((journey, i) => {
    if (!journey || typeof journey.name !== "string" || !journey.name.trim()) fail(`journey #${i + 1} needs a \`name\`.`);
    if (seen.has(journey.name)) fail(`two journeys are called "${journey.name}". Names must be unique.`);
    seen.add(journey.name);
    if (!Array.isArray(journey.steps) || journey.steps.length === 0) fail(`journey "${journey.name}" needs at least one step.`);
    journey.steps.forEach((step, j) => {
      if (!step || typeof step.name !== "string" || typeof step.run !== "function") {
        fail(`step #${j + 1} of "${journey.name}" needs a \`name\` and a \`run\` function.`);
      }
    });
  });
  if (config.timeout !== undefined && !(Number(config.timeout) > 0)) fail("`timeout` must be a positive number of milliseconds.");
  return config;
}
