"use client";

import { useCallback, useEffect, useState } from "react";
import { ORG_ROLES, type OrgRole } from "@/lib/org-roles";

type Member = { email: string; role: OrgRole; status: "active" | "invited"; addedAt: number };
type Org = { id: string; name: string; ownerEmail: string; members: Member[] };

const roleTh = (r: OrgRole) => ORG_ROLES.find((x) => x.id === r)?.th ?? r;

export function OrgSection() {
  const [org, setOrg] = useState<Org | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("trader");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/account/org")
      .then((r) => r.json())
      .then((d) => {
        setOrg(d.org ?? null);
        setIsOwner(Boolean(d.isOwner));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(load, [load]);

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/account/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    load();
  }

  if (!loaded) return <div className="text-sm text-muted">กำลังโหลด…</div>;

  if (!org) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted">สร้างองค์กรเพื่อเชิญทีม (เทรดเดอร์/นักวิเคราะห์/ผู้ชม/ผู้จัดการความเสี่ยง)</p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อองค์กร"
            className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-txt outline-none"
          />
          <button
            onClick={() => mutate({ action: "create", name })}
            disabled={busy || name.trim().length < 2}
            className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-bg disabled:opacity-40"
          >
            สร้างองค์กร
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-txt">{org.name}</div>
        <div className="text-[11px] text-muted">{org.members.length} สมาชิก</div>
      </div>

      <ul className="space-y-2">
        {org.members.map((m) => (
          <li key={m.email} className="flex items-center justify-between rounded-lg border border-line bg-bg px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm text-txt">{m.email}</div>
              <div className="text-[11px] text-muted">
                {roleTh(m.role)}
                {m.status === "invited" && <span className="text-warn"> · รอเข้าร่วม</span>}
              </div>
            </div>
            {isOwner && m.role !== "owner" && (
              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={m.role}
                  onChange={(e) => mutate({ action: "setrole", memberEmail: m.email, role: e.target.value })}
                  className="rounded border border-line bg-panel px-1.5 py-1 text-[11px] text-txt outline-none"
                >
                  {ORG_ROLES.filter((r) => r.id !== "owner").map((r) => (
                    <option key={r.id} value={r.id}>{r.th}</option>
                  ))}
                </select>
                <button
                  onClick={() => mutate({ action: "remove", memberEmail: m.email })}
                  className="text-xs text-down hover:underline"
                >
                  ลบ
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="space-y-2 rounded-lg border border-line bg-bg p-3">
          <div className="text-xs font-medium text-txt">เชิญสมาชิก</div>
          <div className="flex flex-wrap gap-2">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="อีเมลสมาชิก"
              className="min-w-[160px] flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-txt outline-none"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              className="rounded-lg border border-line bg-panel px-2 py-2 text-sm text-txt outline-none"
            >
              {ORG_ROLES.filter((r) => r.id !== "owner").map((r) => (
                <option key={r.id} value={r.id}>{r.th}</option>
              ))}
            </select>
            <button
              onClick={() => {
                mutate({ action: "invite", memberEmail: inviteEmail, role: inviteRole });
                setInviteEmail("");
              }}
              disabled={busy || !inviteEmail.includes("@")}
              className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-bg disabled:opacity-40"
            >
              เชิญ
            </button>
          </div>
          <p className="text-[10px] text-dim">ถ้าอีเมลนี้ยังไม่มีบัญชี จะขึ้นสถานะ “รอเข้าร่วม” จนกว่าจะสมัคร</p>
        </div>
      )}
    </div>
  );
}
