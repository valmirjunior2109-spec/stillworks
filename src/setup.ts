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
    log("… Installing Chromium for Playwright (one time, about 150 MB).");
    await installBrowser({});
  }
}

/** Runs the Playwright CLI that ships with stillworks, so the browser always matches its version. */
export async function installBrowser({ withDeps = false }: { withDeps?: boolean }) {
  const require = createRequire(import.meta.url);
  const cli = join(dirname(require.resolve("playwright/package.json")), "cli.js");
  const args = [cli, "install", "chromium", ...(withDeps ? ["--with-deps"] : [])];
  const code = await new Promise<number>((done) => {
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    child.on("close", (c) => done(c ?? 1));
    child.on("error", () => done(1));
  });
  if (code !== 0) throw new UsageError(`Installing Chromium failed (exit ${code}). Try again, or run: npx playwright install chromium`);
}
