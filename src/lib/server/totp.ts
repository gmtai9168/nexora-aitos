import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * RFC 6238 TOTP (time-based one-time passwords) — real 2FA, no dependency.
 * Compatible with Google Authenticator, Authy, 1Password, etc. Secrets are
 * base32 (RFC 4648) so they encode cleanly into an otpauth:// URI.
 */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30; // seconds
const DIGITS = 6;

export function generateSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter.
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Verifies a code allowing ±`window` steps of clock drift. */
export function verifyTotp(secret: string, token: string, epochMs: number, window = 1): boolean {
  const clean = String(token).replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(epochMs / 1000 / STEP);
  const want = Buffer.from(clean);
  for (let w = -window; w <= window; w++) {
    const got = Buffer.from(hotp(secret, counter + w));
    if (got.length === want.length && timingSafeEqual(got, want)) return true;
  }
  return false;
}

/** otpauth:// URI an authenticator app scans as a QR code. */
export function otpauthUri(secret: string, account: string, issuer = "NEXORA AITOS"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
