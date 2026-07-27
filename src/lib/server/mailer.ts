/**
 * Transactional email. Uses Resend's REST API when RESEND_API_KEY is set;
 * otherwise it's a no-op that reports "not sent" so the flow still works in
 * development (the caller surfaces the code directly when no mailer exists).
 */

export function mailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.EMAIL_FROM || "NEXORA <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function verifyEmailHtml(code: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;background:#0a0e17;color:#e6edf3;padding:32px;border-radius:12px">
      <h2 style="margin:0 0 8px">NEXORA AITOS</h2>
      <p style="color:#9aa7b8;margin:0 0 24px">รหัสยืนยันอีเมลของคุณ / Your verification code</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#5eead4">${code}</div>
      <p style="color:#6b7684;margin:24px 0 0;font-size:13px">รหัสหมดอายุใน 10 นาที · This code expires in 10 minutes.</p>
    </div>`;
}
