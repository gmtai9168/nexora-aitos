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

/**
 * Finds the store's REST credentials whatever the integration named them.
 * Tries the well-known names first, then scans for any prefixed variant
 * (e.g. a "STORAGE_" custom prefix) by matching the URL var to its token.
 */
function creds(): { url: string; token: string } | null {
  const env = process.env;

  const direct: [string, string][] = [
    ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  ];
  for (const [u, t] of direct) {
    if (env[u] && env[t]) return { url: env[u]!.replace(/\/$/, ""), token: env[t]! };
  }

  for (const key of Object.keys(env)) {
    for (const [urlSuffix, tokenSuffix] of [
      ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
      ["REDIS_REST_URL", "REDIS_REST_TOKEN"],
    ] as const) {
      if (key.endsWith(urlSuffix)) {
        const prefix = key.slice(0, key.length - urlSuffix.length);
        const token = env[prefix + tokenSuffix];
        if (env[key] && token) return { url: env[key]!.replace(/\/$/, ""), token };
      }
    }
  }

  return null;
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
