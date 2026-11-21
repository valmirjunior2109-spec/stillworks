import { spawn } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONFIG_FILE, UsageError } from "./config.js";

export const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

export const INTEGRATIONS = {
  claude: { from: "integrations/claude-code/commands/verify.md", to: ".claude/commands/verify.md", label: "Claude Code /verify command" },
  cursor: { from: "integrations/cursor/rules/stillworks.mdc", to: ".cursor/rules/stillworks.mdc", label: "Cursor rule" },
  github: { from: "integrations/github-actions/stillworks.yml", to: ".github/workflows/stillworks.yml", label: "GitHub Action (Vercel previews)" },
} as const;

export type Integration = keyof typeof INTEGRATIONS;

export interface InitOptions {
  cwd?: string;
  config?: string;
  force?: boolean;
  skipInstall?: boolean;
  integrations?: Integration[];
  log?: (line: string) => void;
}

export async function init(options: InitOptions = {}) {
  const cwd = resolve(options.cwd ?? process.cwd());
  const log = options.log ?? ((line: string) => console.log(line));
  const configPath = resolve(cwd, options.config ?? DEFAULT_CONFIG_FILE);

  if (existsSync(configPath) && !options.force) {
    log(`• ${options.config ?? DEFAULT_CONFIG_FILE} already exists, leaving it as is (use --force to replace it).`);
  } else {
    mkdirSync(dirname(configPath), { recursive: true });
    copyFileSync(join(PACKAGE_ROOT, "templates", "journeys.config.ts"), configPath);
    log(`✓ Created ${options.config ?? DEFAULT_CONFIG_FILE} with 3 example journeys: signup, login, checkout.`);
  }

  const gitignore = join(cwd, ".gitignore");
  const current = existsSync(gitignore) ? readFileSync(gitignore, "utf8") : "";
  if (!/^\/?verify-report\/?\s*$/m.test(current)) {
    appendFileSync(gitignore, `${current && !current.endsWith("\n") ? "\n" : ""}verify-report/\n`);
    log("✓ Added verify-report/ to .gitignore.");
  }

  for (const key of options.integrations ?? []) {
    const { from, to, label } = INTEGRATIONS[key];
    const target = join(cwd, to);
    if (existsSync(target) && !options.force) {
      log(`• ${to} already exists, leaving it as is.`);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(PACKAGE_ROOT, from), target);
    log(`✓ Added ${label}: ${to}`);
  }

  if (!options.skipInstall) {
    await addLocalPackage(cwd, log);
    log("… Installing Chromium for Playwright (one time, about 150 MB).");
    await installBrowser({ cwd });
  }
}

/** True when this folder already has its own copy of stillworks (or is the stillworks repo itself). */
export function hasLocalPackage(cwd: string): boolean {
  if (existsSync(join(cwd, "node_modules", "stillworks", "package.json"))) return true;
  try {
    return JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")).name === "stillworks";
  } catch {
    return false;
  }
}

/** The command that adds a dev dependency with the package manager this folder already uses. */
export function addDevCommand(cwd: string): { command: string; args: string[] } {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return { command: "pnpm", args: ["add", "-D"] };
  if (existsSync(join(cwd, "yarn.lock"))) return { command: "yarn", args: ["add", "-D"] };
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) return { command: "bun", args: ["add", "-d"] };
  return { command: "npm", args: ["install", "--save-dev", "--no-audit", "--no-fund"] };
}

/**
 * Adds stillworks as a dev dependency, so `import { defineConfig } from "stillworks"` has types in the editor
 * (no red squiggles, autocomplete for `page`). Running journeys works without it; this is only for the editor,
 * so a failure here never stops init.
 */
async function addLocalPackage(cwd: string, log: (line: string) => void) {
  if (hasLocalPackage(cwd)) return;
  const version = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")).version;
  const { command, args } = addDevCommand(cwd);
  log(`… Adding stillworks to devDependencies (types and autocomplete for ${DEFAULT_CONFIG_FILE}).`);
  const code = await new Promise<number>((done) => {
    const argv = [...args, `stillworks@${version}`];
    // npm, pnpm and yarn are .cmd files on Windows, which only start through a shell. Every argument here is fixed
    // (no user input), and passing one command string avoids Node's warning about args with `shell: true`.
    const child =
      process.platform === "win32"
        ? spawn([command, ...argv].join(" "), { cwd, stdio: "inherit", shell: true })
        : spawn(command, argv, { cwd, stdio: "inherit" });
    child.on("close", (c) => done(c ?? 1));
    child.on("error", () => done(1));
  });
  if (code === 0) log("✓ Added stillworks to devDependencies.");
  else log(`• Couldn't add stillworks to devDependencies. Journeys still run; for editor types, run: npm install --save-dev stillworks`);
}

/**
 * Runs the Playwright CLI that will run the journeys, so the browser always matches its version: the project's
 * own copy of stillworks when there is one (that's what `npx stillworks run` picks), otherwise this one.
 */
export async function installBrowser({ withDeps = false, cwd = process.cwd() }: { withDeps?: boolean; cwd?: string }) {
  const local = join(cwd, "node_modules", "stillworks", "package.json");
  const require = createRequire(existsSync(local) ? local : import.meta.url);
  const cli = join(dirname(require.resolve("playwright/package.json")), "cli.js");
  const args = [cli, "install", "chromium", ...(withDeps ? ["--with-deps"] : [])];
  const code = await new Promise<number>((done) => {
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    child.on("close", (c) => done(c ?? 1));
    child.on("error", () => done(1));
  });
  if (code !== 0) throw new UsageError(`Installing Chromium failed (exit ${code}). Try again, or run: npx playwright install chromium`);
}

/** What to do after init. On Windows, PowerShell often blocks npx.ps1, and npx.cmd always works. */
export function nextSteps(configFile: string, platform: NodeJS.Platform = process.platform): string {
  const lines = [
    "Next:",
    `  1. Edit ${configFile}: set baseURL and change the example journeys so they match your app.`,
    "  2. npx stillworks run --url http://localhost:3000",
  ];
  if (platform === "win32") lines.push("", 'Windows PowerShell says "running scripts is disabled"? Use npx.cmd instead of npx.');
  return lines.join("\n");
}
