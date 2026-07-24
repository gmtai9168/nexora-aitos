/**
 * Minimal durable key–value store over the Upstash Redis REST API.
 *
 * Works with the env vars set by either the Vercel KV integration
 * (KV_REST_API_URL / KV_REST_API_TOKEN) or the Upstash marketplace integration
 * (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN). No SDK dependency — the
 * REST API is a single POST with a command array, so a plain fetch is enough.
 *
 * When no store is configured every call is a no-op that reports "not
 * configured", so the app runs unchanged until the user provisions one.
 */

function creds(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

export function kvConfigured(): boolean {
  return creds() !== null;
}

async function command<T>(args: (string | number)[]): Promise<T | null> {
  const c = creds();
  if (!c) return null;
  try {
    const res = await fetch(c.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: T; error?: string };
    if (data.error) return null;
    return (data.result ?? null) as T | null;
  } catch {
    return null;
  }
}

/** Reads and JSON-parses a value; null when missing, unset, or on any error. */
export async function kvGetJson<T>(key: string): Promise<T | null> {
  const raw = await command<string | null>(["GET", key]);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** JSON-stringifies and stores a value. Returns whether it was written. */
export async function kvSetJson(key: string, value: unknown): Promise<boolean> {
  const res = await command<string>(["SET", key, JSON.stringify(value)]);
  return res === "OK";
}

/** A cheap round-trip to confirm the store answers. */
export async function kvPing(): Promise<boolean> {
  const res = await command<string>(["PING"]);
  return res === "PONG";
}
