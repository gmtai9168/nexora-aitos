import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateUser } from "@/lib/server/users";
import { planById } from "@/lib/plans";

export const runtime = "nodejs";

/**
 * Select a package. Framework only — this records the chosen plan; it never
 * charges. Real payment (Stripe) is a later step, so Enterprise routes to
 * "contact us" instead of self-serve activation.
 */
export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const plan = planById(String(body.plan ?? ""));
  if (plan.id === "enterprise") {
    return NextResponse.json({ ok: true, contact: true, plan: "enterprise" });
  }

  await updateUser(email, { plan: plan.id });
  return NextResponse.json({ ok: true, plan: plan.id, charged: false });
}
