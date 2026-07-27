import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createOrg,
  getOrgForUser,
  addMember,
  setMemberRole,
  removeMember,
  type OrgRole,
} from "@/lib/server/orgs";

export const runtime = "nodejs";

const ROLES: OrgRole[] = ["owner", "trader", "analyst", "viewer", "risk"];

async function email() {
  const s = await auth();
  return s?.user?.email?.toLowerCase() ?? null;
}

export async function GET() {
  const me = await email();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const org = await getOrgForUser(me);
  return NextResponse.json({ org, isOwner: org?.ownerEmail === me });
}

export async function POST(req: Request) {
  const me = await email();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { action?: string; name?: string; memberEmail?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Create — only if the user isn't already in an org.
  if (body.action === "create") {
    if (await getOrgForUser(me)) return NextResponse.json({ error: "already_in_org" }, { status: 409 });
    const org = await createOrg(me, String(body.name ?? ""));
    return NextResponse.json({ ok: true, org });
  }

  // All member mutations require the requester to be the org owner.
  const org = await getOrgForUser(me);
  if (!org) return NextResponse.json({ error: "no_org" }, { status: 404 });
  if (org.ownerEmail !== me) return NextResponse.json({ error: "not_owner" }, { status: 403 });

  const role = (ROLES.includes(body.role as OrgRole) ? body.role : "viewer") as OrgRole;
  const memberEmail = String(body.memberEmail ?? "").trim().toLowerCase();

  if (body.action === "invite") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberEmail)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }
    const next = await addMember(org.id, memberEmail, role === "owner" ? "viewer" : role);
    return NextResponse.json({ ok: true, org: next });
  }
  if (body.action === "setrole") {
    const next = await setMemberRole(org.id, memberEmail, role);
    return NextResponse.json({ ok: true, org: next });
  }
  if (body.action === "remove") {
    const next = await removeMember(org.id, memberEmail);
    return NextResponse.json({ ok: true, org: next });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
