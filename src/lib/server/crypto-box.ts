import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

/**
 * Authenticated symmetric encryption (AES-256-GCM) for secrets stored at rest,
 * e.g. exchange API secrets. The key comes from ENCRYPTION_KEY (any string —
 * hashed to 32 bytes). When it's unset, encryption is unavailable and callers
 * must refuse to store the secret rather than persist it in the clear.
 */

export function encryptionAvailable(): boolean {
  return Boolean(process.env.ENCRYPTION_KEY);
}

function keyBytes(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY not set");
  return createHash("sha256").update(raw).digest();
}

/** Returns `iv:tag:ciphertext`, all base64. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

/** Show only the last few chars of a secret for display (e.g. •••• 4f9c). */
export function maskTail(secret: string, keep = 4): string {
  if (secret.length <= keep) return "••••";
  return `•••• ${secret.slice(-keep)}`;
}
