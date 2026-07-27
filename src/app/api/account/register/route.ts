import { NextResponse } from "next/server";
import { createUser, getUser, toPublic } from "@/lib/server/users";
import { issueCode } from "@/lib/server/verify";
import { sendEmail, mailerConfigured, verifyEmailHtml } from "@/lib/server/mailer";

export const runtime = "nodejs";

function validEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: Request) {
  let body: { email?: string; name?: string; password?: string; country?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  const country = body.country ? String(body.country).trim() : undefined;

  if (!validEmail(email)) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "weak_password" }, { status: 400 });

  if (await getUser(email)) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const user = await createUser({ email, name, password, country });

  // Issue + deliver the email verification code.
  const code = await issueCode("email", email);
  const sent = mailerConfigured()
    ? await sendEmail(email, "NEXORA — ยืนยันอีเมล / Verify your email", verifyEmailHtml(code))
    : false;

  return NextResponse.json({
    ok: true,
    user: toPublic(user),
    needsVerify: true,
    emailed: sent,
    // Only surfaced when no mailer is configured, so the dev flow is testable.
    devCode: mailerConfigured() ? undefined : code,
  });
}
