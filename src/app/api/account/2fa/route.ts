import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUser, updateUser } from "@/lib/server/users";
import { kvGetJson, kvSetJsonEx } from "@/lib/server/kv";
import { generateSecret, otpauthUri, verifyTotp } from "@/lib/server/totp";

export const runtime = "nodejs";

const pendingKey = (email: string) => `nexora:2fa-setup:${email.toLowerCase()}`;

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const user = await getUser(email);
  if (!user) return NextResponse.json({ error: "unknown_user" }, { status: 404 });

  let body: { action?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // 1) Begin setup — mint a secret, stash it (pending) for 10 min, hand back the QR URI.
  if (body.action === "setup") {
    const secret = generateSecret();
    await kvSetJsonEx(pendingKey(email), { secret }, 600);
    return NextResponse.json({ ok: true, secret, otpauth: otpauthUri(secret, email) });
  }

  // 2) Enable — confirm a code from the pending secret, then commit it to the account.
  if (body.action === "enable") {
    const pending = await kvGetJson<{ secret: string }>(pendingKey(email));
    if (!pending?.secret) return NextResponse.json({ error: "no_setup" }, { status: 400 });
    if (!verifyTotp(pending.secret, String(body.code ?? ""), Date.now())) {
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }
    await updateUser(email, { twoFactorEnabled: true, totpSecret: pending.secret });
    await kvSetJsonEx(pendingKey(email), { secret: "" }, 1);
    return NextResponse.json({ ok: true, enabled: true });
  }

  // 3) Disable — require a valid current code before removing 2FA.
  if (body.action === "disable") {
    if (!user.twoFactorEnabled || !user.totpSecret) {
      return NextResponse.json({ ok: true, enabled: false });
    }
    if (!verifyTotp(user.totpSecret, String(body.code ?? ""), Date.now())) {
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }
    await updateUser(email, { twoFactorEnabled: false, totpSecret: undefined });
    return NextResponse.json({ ok: true, enabled: false });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
