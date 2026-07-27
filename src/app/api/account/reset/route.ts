import { NextResponse } from "next/server";
import { updatePassword } from "@/lib/server/users";
import { checkCode } from "@/lib/server/verify";

export const runtime = "nodejs";

/** POST { email, code, password } → verify the reset code and set a new password. */
export async function POST(req: Request) {
  let body: { email?: string; code?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").trim();
  const password = String(body.password ?? "");

  if (!email || !code) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "weak_password" }, { status: 400 });

  if (!(await checkCode("reset", email, code))) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const ok = await updatePassword(email, password);
  if (!ok) return NextResponse.json({ error: "unknown_user" }, { status: 404 });

  return NextResponse.json({ ok: true, reset: true });
}
