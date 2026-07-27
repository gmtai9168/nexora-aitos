"use client";

import { useState } from "react";
import { PLANS, priceLabel, type PlanId } from "@/lib/plans";

export function BillingSection({ plan, onChange }: { plan: string; onChange: () => void }) {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [msg, setMsg] = useState("");

  async function choose(id: PlanId) {
    setBusy(id);
    setMsg("");
    const r = await fetch("/api/account/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: id }),
    }).then((x) => x.json());
    setBusy(null);
    if (r.contact) {
      setMsg("แพ็กเกจ Enterprise — ทีมงานจะติดต่อกลับ (ยังไม่มีการเปิดใช้อัตโนมัติ)");
      return;
    }
    if (r.ok) onChange();
  }

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
        โหมดเดโม — การเลือกแพ็กเกจนี้ยัง <b>ไม่มีการเก็บเงินจริง</b> (จะต่อระบบชำระเงินภายหลัง)
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PLANS.map((p) => {
          const current = p.id === plan;
          return (
            <div
              key={p.id}
              className={`rounded-xl border p-4 ${current ? "border-brand bg-brand/5" : "border-line bg-bg"}`}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-semibold text-txt">{p.name}</div>
                <div className="text-xs text-brand">{priceLabel(p)}</div>
              </div>
              <div className="mt-0.5 text-[11px] text-muted">{p.tagline} · {p.suits}</div>
              <ul className="mt-2 space-y-1">
                {p.features.map((f) => (
                  <li key={f} className="text-[11px] text-muted">• {f}</li>
                ))}
              </ul>
              <button
                onClick={() => choose(p.id)}
                disabled={current || busy === p.id}
                className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold ${
                  current ? "cursor-default bg-line text-muted" : "bg-brand text-bg hover:opacity-90"
                } disabled:opacity-60`}
              >
                {current ? "แพ็กเกจปัจจุบัน" : busy === p.id ? "กำลังบันทึก…" : p.id === "enterprise" ? "ติดต่อทีมงาน" : "เลือกแพ็กเกจนี้"}
              </button>
            </div>
          );
        })}
      </div>
      {msg && <div className="text-xs text-muted">{msg}</div>}
    </div>
  );
}
