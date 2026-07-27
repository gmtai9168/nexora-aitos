import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";
import { kvGetJson, kvSetJson } from "./kv";
import type { Role } from "../rbac";

/**
 * KV-backed user store for real auth (Auth.js Credentials + OAuth).
 *
 * Passwords are salted + scrypt-hashed; the plain password is never stored.
 * Records live under `nexora:user:<email>` (email lowercased). This is the
 * durable identity layer the whole account system builds on.
 */

export type KycStatus = "none" | "pending" | "approved" | "rejected";

/** Result of the AI onboarding questionnaire — drives dashboard defaults. */
export type OnboardingProfile = {
  experience: "new" | "some" | "pro";
  risk: "low" | "medium" | "high";
  goals: string[];
  markets: string[];
  capital: string;
  autopilot: boolean;
  suggestedPlan: string;
  completedAt: number;
};

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  country?: string;
  /** `${saltHex}:${hashHex}`; absent for OAuth-only accounts. */
  password?: string;
  role: Role;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  /** base32 TOTP secret when 2FA is set up (kept server-side only). */
  totpSecret?: string;
  kyc: KycStatus;
  plan: string;
  /** org id when the user belongs to a company/fund org. */
  orgId?: string;
  /** AI onboarding answers + derived dashboard preferences. */
  profile?: OnboardingProfile;
  provider: "credentials" | "google" | "apple" | "microsoft" | "github";
  createdAt: number;
};

/** A user the client may see — never includes secrets. */
export type PublicUser = Omit<StoredUser, "password" | "totpSecret">;

const key = (email: string) => `nexora:user:${email.trim().toLowerCase()}`;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function getUser(email: string): Promise<StoredUser | null> {
  return kvGetJson<StoredUser>(key(email));
}

export function toPublic(u: StoredUser): PublicUser {
  const { password, totpSecret, ...rest } = u;
  void password;
  void totpSecret;
  return rest;
}

/** The owner's email (from env) is granted Founder; everyone else starts Personal. */
function initialRole(email: string): Role {
  const founder = process.env.FOUNDER_EMAIL?.trim().toLowerCase();
  return founder && email.trim().toLowerCase() === founder ? "founder" : "personal";
}

export async function createUser(input: {
  email: string;
  name: string;
  password?: string;
  country?: string;
  provider?: StoredUser["provider"];
  emailVerified?: boolean;
}): Promise<StoredUser> {
  const email = input.email.trim().toLowerCase();
  const user: StoredUser = {
    id: randomUUID(),
    email,
    name: input.name || email.split("@")[0],
    country: input.country,
    password: input.password ? hashPassword(input.password) : undefined,
    role: initialRole(email),
    emailVerified: input.emailVerified ?? false,
    twoFactorEnabled: false,
    kyc: "none",
    plan: "free",
    provider: input.provider ?? "credentials",
    createdAt: Date.now(),
  };
  await kvSetJson(key(email), user);
  return user;
}

/** Merge a patch into a stored user. */
export async function updateUser(email: string, patch: Partial<StoredUser>): Promise<StoredUser | null> {
  const current = await getUser(email);
  if (!current) return null;
  const next = { ...current, ...patch, email: current.email, id: current.id };
  await kvSetJson(key(email), next);
  return next;
}

/** Find-or-create for OAuth sign-ins. */
export async function upsertOAuthUser(input: {
  email: string;
  name: string;
  provider: StoredUser["provider"];
}): Promise<StoredUser> {
  const existing = await getUser(input.email);
  if (existing) return existing;
  return createUser({ ...input, emailVerified: true });
}
