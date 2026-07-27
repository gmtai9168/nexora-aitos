import { NextResponse } from "next/server";
import { enabledProviders } from "@/auth";

export const runtime = "nodejs";

/** Lets the login page render only the OAuth buttons that are actually wired. */
export function GET() {
  return NextResponse.json({ providers: enabledProviders() });
}
