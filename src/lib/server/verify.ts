import { randomInt } from "node:crypto";
import { kvGetJson, kvSetJsonEx } from "./kv";

/**
 * Short-lived verification codes (email confirm, phone OTP, sensitive actions).
 * Stored in KV with a TTL so they expire on their own. The same 6-digit
 * mechanism backs both email verification and OTP.
 */

const TTL_SEC = 600; // 10 minutes
const keyFor = (purpose: string, id: string) => `nexora:otp:${purpose}:${id.trim().toLowerCase()}`;

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function issueCode(purpose: string, id: string): Promise<string> {
  const code = newCode();
  await kvSetJsonEx(keyFor(purpose, id), { code, at: Date.now() }, TTL_SEC);
  return code;
}

export async function checkCode(purpose: string, id: string, code: string): Promise<boolean> {
  const rec = await kvGetJson<{ code: string }>(keyFor(purpose, id));
  return Boolean(rec && rec.code === String(code).trim());
}
