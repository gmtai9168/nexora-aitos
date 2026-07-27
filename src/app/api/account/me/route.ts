import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUser, toPublic } from "@/lib/server/users";

export const runtime = "nodejs";

/** The signed-in user's own public profile (no secrets). */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = await getUser(email);
  if (!user) return NextResponse.json({ error: "unknown_user" }, { status: 404 });
  return NextResponse.json({ user: toPublic(user) });
}
