import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Apple from "next-auth/providers/apple";
import type { Provider } from "next-auth/providers";
import type { Role } from "./lib/rbac";
import { getUser, upsertOAuthUser, verifyPassword } from "./lib/server/users";
import { verifyTotp } from "./lib/server/totp";

/**
 * Auth.js (NextAuth v5) — email/password + OAuth, JWT sessions.
 *
 * OAuth providers activate only when their AUTH_<PROVIDER>_ID/SECRET env vars
 * are present, so the app builds and runs with just email/password until the
 * operator registers each OAuth app. The signed-in user's RBAC role rides in
 * the JWT and drives the whole permission layer.
 */

const providers: Provider[] = [
  Credentials({
    name: "Email",
    credentials: { email: {}, password: {}, totp: {} },
    async authorize(creds) {
      const email = String(creds?.email ?? "").trim().toLowerCase();
      const password = String(creds?.password ?? "");
      if (!email || !password) return null;
      const user = await getUser(email);
      if (!user || !verifyPassword(password, user.password)) return null;
      // Second factor is mandatory once the user has enabled it.
      if (user.twoFactorEnabled && user.totpSecret) {
        const totp = String(creds?.totp ?? "");
        if (!verifyTotp(user.totpSecret, totp, Date.now())) return null;
      }
      return { id: user.id, email: user.email, name: user.name };
    },
  }),
];

// Env-gated OAuth — each turns on the moment its credentials are provisioned.
if (process.env.AUTH_GITHUB_ID) providers.push(GitHub);
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID) providers.push(MicrosoftEntraID);
if (process.env.AUTH_APPLE_ID) providers.push(Apple);

/** Which OAuth buttons the login page should render (read by an API route). */
export function enabledProviders(): string[] {
  const out: string[] = [];
  if (process.env.AUTH_GITHUB_ID) out.push("github");
  if (process.env.AUTH_GOOGLE_ID) out.push("google");
  if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID) out.push("microsoft-entra-id");
  if (process.env.AUTH_APPLE_ID) out.push("apple");
  return out;
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      // OAuth sign-ins get a durable KV record (find-or-create) on first login.
      if (account && account.provider !== "credentials" && user.email) {
        await upsertOAuthUser({
          email: user.email,
          name: user.name ?? user.email.split("@")[0],
          provider: account.provider as "github" | "google" | "apple" | "microsoft",
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const db = await getUser(user.email);
        token.role = (db?.role ?? "personal") as Role;
        token.uid = db?.id ?? user.id;
        token.verified = db?.emailVerified ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as Role) ?? "personal";
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.verified = Boolean(token.verified);
      }
      return session;
    },
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
