import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUser } from "@/lib/server/users";
import { getKyc, reviewKyc, toSummary } from "@/lib/server/kyc";

export const runtime = "nodejs";

/** Returns the reviewer's email if they hold an admin/founder role, else null. */
async function requireAdmin(): Promise<string | null> {
  const s = await auth();
  const email = s?.user?.email?.toLowerCase();
  if (!email) return null;
  const user = await getUser(email);
  return user && (user.role === "admin" || user.role === "founder") ? email : null;
}

/** GET ?email= → view a submission (with image) for review. */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const target = new URL(req.url).searchParams.get("email");
  if (!target) return NextResponse.json({ error: "missing_email" }, { status: 400 });
  const sub = await getKyc(target);
  return NextResponse.json({ submission: sub });
}

/** POST { email, decision: "approved"|"rejected", reason? } */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { email?: string; decision?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const target = String(body.email ?? "").trim().toLowerCase();
  const decision = body.decision === "approved" ? "approved" : body.decision === "rejected" ? "rejected" : null;
  if (!target || !decision) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const sub = await reviewKyc(target, decision, admin, body.reason?.slice(0, 200));
  if (!sub) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, submission: toSummary(sub) });
}
