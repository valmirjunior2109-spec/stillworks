import { writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { REPORT_FOOTER } from "./promo.js";
import type { JourneyResult, RunResult } from "./runner.js";

export interface ReportOptions {
  /** Paths in the report are relative to this folder (default: the current folder), so your agent can open them. */
  cwd?: string;
  /** The command that reproduces this run. */
  rerun?: string;
}

export function renderReport(result: RunResult, options: ReportOptions = {}): string {
  const cwd = options.cwd ?? process.cwd();
  const rerun = options.rerun ?? `npx stillworks run --url ${result.baseURL}`;
  const ran = result.journeys.filter((j) => j.status !== "skipped");
  const failed = ran.filter((j) => j.status === "failed");
  const passed = ran.filter((j) => j.status === "passed");
  const lines: string[] = [];

  if (failed.length === 0) {
    lines.push(`# stillworks: all ${ran.length} ${plural(ran.length, "journey")} passed`, "");
    lines.push(`Checked ${result.baseURL} in a real browser on ${result.startedAt}. Nothing to fix.`, "");
  } else {
    lines.push(`# stillworks: ${failed.length} of ${ran.length} ${plural(ran.length, "journey")} failed`, "");
    lines.push(`> Paste everything below into your coding agent (Claude Code, Cursor, Codex, Copilot, Windsurf).`, "");
    lines.push("---", "");
    for (const journey of failed) lines.push(...describeFailure(journey, cwd), "");
    const others = passed.map((j) => `\`${j.name}\``);
    lines.push(
      `Fix this without changing unrelated files. Find the root cause (start from the failed requests and console errors above); ` +
        `don't change the journey or weaken the check to make it pass.` +
        (others.length ? ` These journeys still pass, keep them passing: ${others.join(", ")}.` : ""),
      "",
      `When you're done, run \`${rerun}\` and confirm every journey passes.`,
      "",
    );
  }

  lines.push("## Journeys", "", "| Journey | Result | Steps | Time |", "| --- | --- | --- | --- |");
  for (const journey of result.journeys) {
    const done = journey.steps.filter((s) => s.status === "passed").length;
    const label = journey.status === "passed" ? "✅ passed" : journey.status === "failed" ? "❌ failed" : "⏭️ skipped";
    lines.push(`| ${escapeCell(journey.name)} | ${label} | ${done}/${journey.steps.length} | ${seconds(journey.durationMs)} |`);
  }
  lines.push("", "---", "", REPORT_FOOTER, "");
  return lines.join("\n");
}

function describeFailure(journey: JourneyResult, cwd: string): string[] {
  const lines: string[] = [];
  const total = journey.steps.length;
  const index = journey.failedStep;
  const step = index === undefined ? undefined : journey.steps[index];

  if (step && index !== undefined) {
    lines.push(`## The \`${journey.name}\` journey failed at step ${index + 1} of ${total}: "${step.name}"`, "");
    const before = journey.steps.slice(0, index);
    if (before.length) lines.push(`Steps that passed before it: ${before.map((s, i) => `${i + 1}. ${s.name}`).join(" · ")}`, "");
    if (step.error) lines.push("Error:", "", fence(step.error), "");
    if (step.url) lines.push(`Page URL when it failed: ${step.url}`, "");
  } else {
    lines.push(`## The \`${journey.name}\` journey failed`, "", journey.reason ?? "", "");
  }

  if (journey.consoleErrors.length) {
    lines.push("Console errors:", "", ...journey.consoleErrors.slice(0, 10).map((e) => `- ${oneLine(e)}`), "");
  }
  if (journey.failedRequests.length) {
    lines.push("Failed requests:", "");
    for (const request of journey.failedRequests.slice(0, 10)) {
      const outcome = request.status ? `${request.status}${request.statusText ? ` ${request.statusText}` : ""}` : request.failure;
      lines.push(`- ${request.method} ${request.url} → ${outcome}`);
      if (request.body) lines.push(`  Response: \`${oneLine(request.body).replace(/`/g, "'")}\``);
    }
    lines.push("");
  }
  const shot = step?.screenshot ?? [...journey.steps].reverse().find((s) => s.screenshot)?.screenshot;
  if (shot) lines.push(`Screenshot: ${toReportPath(shot, cwd)}`);
  return lines;
}

/** Writes REPORT.md and report.json into outDir and returns their paths. */
export function writeReport(result: RunResult, outDir: string, options: ReportOptions = {}) {
  const dir = resolve(outDir);
  const markdown = join(dir, "REPORT.md");
  const json = join(dir, "report.json");
  writeFileSync(markdown, renderReport(result, options));
  const cwd = options.cwd ?? process.cwd();
  const portable = {
    ...result,
    journeys: result.journeys.map((j) => ({ ...j, steps: j.steps.map((s) => ({ ...s, screenshot: s.screenshot && toReportPath(s.screenshot, cwd) })) })),
  };
  writeFileSync(json, `${JSON.stringify(portable, null, 2)}\n`);
  return { markdown, json };
}

export function toReportPath(file: string, cwd: string) {
  const rel = relative(cwd, file);
  return (rel.startsWith("..") ? file : rel).split(sep).join("/");
}

const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const oneLine = (text: string) => text.replace(/\s*\n\s*/g, " ⏎ ").trim();
const escapeCell = (text: string) => text.replace(/\|/g, "\\|");

function fence(text: string) {
  const ticks = text.includes("```") ? "````" : "```";
  return `${ticks}\n${text}\n${ticks}`;
}
