import { NextResponse } from "next/server";
import { getUser, updateUser } from "@/lib/server/users";
import { checkCode, issueCode } from "@/lib/server/verify";
import { sendEmail, mailerConfigured, verifyEmailHtml } from "@/lib/server/mailer";

export const runtime = "nodejs";

/** POST { email, code } → confirm. POST { email, resend:true } → re-issue a code. */
export async function POST(req: Request) {
  let body: { email?: string; code?: string; resend?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !(await getUser(email))) {
    return NextResponse.json({ error: "unknown_user" }, { status: 404 });
  }

  if (body.resend) {
    const code = await issueCode("email", email);
    const sent = mailerConfigured()
      ? await sendEmail(email, "NEXORA — ยืนยันอีเมล / Verify your email", verifyEmailHtml(code))
      : false;
    return NextResponse.json({ ok: true, emailed: sent, devCode: mailerConfigured() ? undefined : code });
  }

  const code = String(body.code ?? "").trim();
  if (!(await checkCode("email", email, code))) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  await updateUser(email, { emailVerified: true });
  return NextResponse.json({ ok: true, verified: true });
}
