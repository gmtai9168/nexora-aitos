import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateUser, type OnboardingProfile } from "@/lib/server/users";

export const runtime = "nodejs";

/** Maps questionnaire answers to a suggested package (a recommendation only —
 *  it never elevates the account's role or charges anything). */
function suggestPlan(p: {
  experience: string;
  risk: string;
  markets: string[];
  capital: string;
}): string {
  if (p.capital === "1m+" || p.markets.length >= 3) return "pro";
  if (p.experience === "pro" || p.risk === "high") return "plus";
  return "free";
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: Partial<OnboardingProfile>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const profile: OnboardingProfile = {
    experience: (["new", "some", "pro"].includes(String(body.experience))
      ? body.experience
      : "new") as OnboardingProfile["experience"],
    risk: (["low", "medium", "high"].includes(String(body.risk))
      ? body.risk
      : "medium") as OnboardingProfile["risk"],
    goals: Array.isArray(body.goals) ? body.goals.slice(0, 8).map(String) : [],
    markets: Array.isArray(body.markets) ? body.markets.slice(0, 8).map(String) : [],
    capital: String(body.capital ?? "unknown"),
    autopilot: Boolean(body.autopilot),
    suggestedPlan: "free",
    completedAt: Date.now(),
  };
  profile.suggestedPlan = suggestPlan(profile);

  await updateUser(email, { profile });
  return NextResponse.json({ ok: true, profile });
}
