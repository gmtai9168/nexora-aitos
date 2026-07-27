import { NextResponse } from "next/server";
import { getUser, verifyPassword } from "@/lib/server/users";

export const runtime = "nodejs";

/**
 * First-factor pre-check so the login page knows whether to prompt for a 2FA
 * code before completing sign-in. Only reveals the 2FA flag when the password
 * is correct; otherwise returns a generic failure.
 */
export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const user = await getUser(email);
  if (!user || !verifyPassword(password, user.password)) {
    return NextResponse.json({ ok: false });
  }
  return NextResponse.json({ ok: true, twoFactor: Boolean(user.twoFactorEnabled) });
}
