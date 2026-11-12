import { UsageError, type Config } from "./config.js";

export function resolveBaseURL(flag: string | undefined, config: Pick<Config, "baseURL">, env: NodeJS.ProcessEnv = process.env): string {
  const raw = (flag ?? env.STILLWORKS_URL ?? config.baseURL ?? "").trim();
  if (!raw) throw new UsageError("Which app should I check? Pass --url http://localhost:3000 (or set baseURL in the config).");
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `${/^(localhost|127\.|\[::1\])/.test(raw) ? "http" : "https"}://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new UsageError(`"${raw}" isn't a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UsageError(`Only http and https URLs work, got "${raw}".`);
  return url.href.replace(/\/$/, "");
}

export function parseHeaders(list: string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const item of list) {
    const at = item.indexOf(":");
    if (at < 1) throw new UsageError(`--header needs "name: value", got "${item}".`);
    headers[item.slice(0, at).trim().toLowerCase()] = item.slice(at + 1).trim();
  }
  return headers;
}

