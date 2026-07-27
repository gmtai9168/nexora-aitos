import { kvGetJson, kvSetJson } from "./kv";
import { encrypt, decrypt, maskTail } from "./crypto-box";

/**
 * Per-user exchange API connection (Trade-Only intent). The secret is encrypted
 * at rest with crypto-box. IMPORTANT: connecting a key does NOT enable real
 * order flow — the platform stays PAPER/testnet. Keys are stored so the future
 * live-trading step (a separate, explicit opt-in) has them, and so the user can
 * see/manage what they've connected.
 */

export type ExchangeId = "binance" | "bybit" | "okx";

export type StoredConnection = {
  exchange: ExchangeId;
  apiKey: string;
  /** AES-GCM encrypted secret (never returned to the client). */
  secretEnc: string;
  /** User's stated permission scope — informational; we never place orders. */
  scope: "read-only" | "trade-only";
  label?: string;
  createdAt: number;
};

export type PublicConnection = {
  exchange: ExchangeId;
  apiKeyMasked: string;
  scope: StoredConnection["scope"];
  label?: string;
  createdAt: number;
};

const key = (email: string) => `nexora:exchange:${email.trim().toLowerCase()}`;

export async function getConnections(email: string): Promise<StoredConnection[]> {
  return (await kvGetJson<StoredConnection[]>(key(email))) ?? [];
}

export function toPublicConnection(c: StoredConnection): PublicConnection {
  return {
    exchange: c.exchange,
    apiKeyMasked: maskTail(c.apiKey),
    scope: c.scope,
    label: c.label,
    createdAt: c.createdAt,
  };
}

export async function saveConnection(
  email: string,
  input: { exchange: ExchangeId; apiKey: string; secret: string; scope: StoredConnection["scope"]; label?: string },
): Promise<StoredConnection> {
  const list = await getConnections(email);
  const conn: StoredConnection = {
    exchange: input.exchange,
    apiKey: input.apiKey,
    secretEnc: encrypt(input.secret),
    scope: input.scope,
    label: input.label,
    createdAt: Date.now(),
  };
  // One connection per exchange — replace any existing.
  const next = [...list.filter((c) => c.exchange !== input.exchange), conn];
  await kvSetJson(key(email), next);
  return conn;
}

export async function removeConnection(email: string, exchange: ExchangeId): Promise<void> {
  const list = await getConnections(email);
  await kvSetJson(key(email), list.filter((c) => c.exchange !== exchange));
}

/** Decrypts a stored secret (server-side only; e.g. for a future live step). */
export function revealSecret(c: StoredConnection): string {
  return decrypt(c.secretEnc);
}
