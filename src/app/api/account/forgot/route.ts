import { NextResponse } from "next/server";
import { getUser } from "@/lib/server/users";
import { issueCode } from "@/lib/server/verify";
import { sendEmail, mailerConfigured } from "@/lib/server/mailer";

export const runtime = "nodejs";

function resetHtml(code: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;background:#0a0e17;color:#e6edf3;padding:32px;border-radius:12px">
      <h2 style="margin:0 0 8px">NEXORA AITOS</h2>
      <p style="color:#9aa7b8;margin:0 0 24px">รหัสสำหรับตั้งรหัสผ่านใหม่ / Password reset code</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#5eead4">${code}</div>
      <p style="color:#6b7684;margin:24px 0 0;font-size:13px">รหัสหมดอายุใน 10 นาที · ถ้าคุณไม่ได้ร้องขอ ให้เพิกเฉยอีเมลนี้</p>
    </div>`;
}

/** POST { email } → issue a reset code. Always responds ok to avoid leaking
 *  which emails exist; the dev code is only returned when the user exists and
 *  no mailer is configured. */
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const user = email ? await getUser(email) : null;

  if (!user) {
    // Same shape as success — don't reveal non-existence.
    return NextResponse.json({ ok: true });
  }

  const code = await issueCode("reset", email);
  const sent = mailerConfigured()
    ? await sendEmail(email, "NEXORA — ตั้งรหัสผ่านใหม่ / Reset your password", resetHtml(code))
    : false;

  return NextResponse.json({
    ok: true,
    emailed: sent,
    devCode: mailerConfigured() ? undefined : code,
  });
}
