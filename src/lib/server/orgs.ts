import { randomUUID } from "node:crypto";
import { kvGetJson, kvSetJson } from "./kv";
import { getUser, updateUser } from "./users";
import { ORG_ROLES, type OrgRole } from "../org-roles";

export { ORG_ROLES, type OrgRole };

/**
 * Lightweight organizations so a company/fund can have several members with
 * distinct in-org roles. Stored at `nexora:org:<id>`; each member's user record
 * carries the `orgId` back-reference. Invitations attach immediately when the
 * invitee already has an account, otherwise they wait as "invited" until signup.
 */

export type OrgMember = {
  email: string;
  role: OrgRole;
  status: "active" | "invited";
  addedAt: number;
};

export type Org = {
  id: string;
  name: string;
  ownerEmail: string;
  members: OrgMember[];
  createdAt: number;
};

const key = (id: string) => `nexora:org:${id}`;

export async function getOrg(id: string): Promise<Org | null> {
  return kvGetJson<Org>(key(id));
}

export async function getOrgForUser(email: string): Promise<Org | null> {
  const user = await getUser(email);
  if (!user?.orgId) return null;
  return getOrg(user.orgId);
}

export async function createOrg(ownerEmail: string, name: string): Promise<Org> {
  const email = ownerEmail.trim().toLowerCase();
  const org: Org = {
    id: randomUUID(),
    name: name.trim().slice(0, 60) || "องค์กรของฉัน",
    ownerEmail: email,
    members: [{ email, role: "owner", status: "active", addedAt: Date.now() }],
    createdAt: Date.now(),
  };
  await kvSetJson(key(org.id), org);
  await updateUser(email, { orgId: org.id });
  return org;
}

async function save(org: Org): Promise<Org> {
  await kvSetJson(key(org.id), org);
  return org;
}

export async function addMember(orgId: string, rawEmail: string, role: OrgRole): Promise<Org | null> {
  const org = await getOrg(orgId);
  if (!org) return null;
  const email = rawEmail.trim().toLowerCase();
  if (org.members.some((m) => m.email === email)) return org;

  const invitee = await getUser(email);
  org.members.push({
    email,
    role,
    status: invitee ? "active" : "invited",
    addedAt: Date.now(),
  });
  if (invitee) await updateUser(email, { orgId: org.id });
  return save(org);
}

export async function setMemberRole(orgId: string, email: string, role: OrgRole): Promise<Org | null> {
  const org = await getOrg(orgId);
  if (!org) return null;
  const m = org.members.find((x) => x.email === email.toLowerCase());
  if (!m || m.role === "owner") return org; // never demote the owner here
  m.role = role;
  return save(org);
}

export async function removeMember(orgId: string, email: string): Promise<Org | null> {
  const org = await getOrg(orgId);
  if (!org) return null;
  const target = email.toLowerCase();
  if (target === org.ownerEmail) return org; // owner can't be removed
  org.members = org.members.filter((m) => m.email !== target);
  await updateUser(target, { orgId: undefined });
  return save(org);
}
