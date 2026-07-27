"use client";

import { useCallback, useEffect, useState } from "react";
import { useRole } from "@/lib/role-context";

type Sub = {
  email: string;
  fullName: string;
  docType: "id_card" | "passport" | "driver_license";
  docNumber: string;
  status: "none" | "pending" | "approved" | "rejected";
  submittedAt: number;
  reviewedAt?: number;
  reviewer?: string;
  reason?: string;
  hasImage?: boolean;
};

const DOC_TH: Record<string, string> = {
  id_card: "บัตรประชาชน",
  passport: "พาสปอร์ต",
  driver_license: "ใบขับขี่",
};

const STATUS_TH: Record<string, { th: string; cls: string }> = {
  pending: { th: "รอตรวจสอบ", cls: "text-warn" },
  approved: { th: "ผ่านแล้ว", cls: "text-up" },
  rejected: { th: "ไม่ผ่าน", cls: "text-down" },
};

function fmt(ts: number): string {
  try {
    return new Date(ts).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

export default function AdminKycPage() {
  const { role } = useRole();
  const isAdmin = role === "admin" || role === "founder";

  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [image, setImage] = useState<{ email: string; src?: string } | null>(null);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/kyc")
      .then((r) => (r.ok ? r.json() : { submissions: [] }))
      .then((d) => setSubs(d.submissions ?? []))
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  async function viewImage(email: string) {
    setImage({ email });
    const d = await fetch(`/api/admin/kyc?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .catch(() => ({}));
    setImage({ email, src: d.submission?.docImage });
  }

  async function decide(email: string, decision: "approved" | "rejected") {
    setBusy(email);
    await fetch("/api/admin/kyc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, decision, reason: decision === "rejected" ? reason : undefined }),
    });
    setBusy("");
    setReasonFor(null);
    setReason("");
    load();
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <div className="text-lg font-semibold text-txt">เฉพาะผู้ดูแลระบบ</div>
        <p className="mt-2 text-sm text-muted">หน้านี้เปิดให้เฉพาะ Admin และ Founder เท่านั้น</p>
      </div>
    );
  }

  const pending = subs.filter((s) => s.status === "pending");
  const reviewed = subs.filter((s) => s.status !== "pending");

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-txt">ตรวจสอบ KYC</h1>
        <button onClick={load} className="text-xs text-brand hover:underline">รีเฟรช</button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted">กำลังโหลด…</div>
      ) : subs.length === 0 ? (
        <div className="rounded-2xl border border-line bg-panel p-8 text-center text-sm text-muted">
          ยังไม่มีคำขอ KYC
        </div>
      ) : (
        <>
          <section>
            <div className="mb-2 text-xs font-medium text-warn">รอตรวจสอบ ({pending.length})</div>
            {pending.length === 0 ? (
              <p className="text-xs text-muted">— ไม่มีรายการรอตรวจสอบ —</p>
            ) : (
              <ul className="space-y-2">
                {pending.map((s) => (
                  <li key={s.email} className="rounded-xl border border-line bg-panel p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-txt">{s.fullName}</div>
                        <div className="truncate text-xs text-muted">{s.email}</div>
                        <div className="mt-1 text-[11px] text-muted">
                          {DOC_TH[s.docType]} · เลขที่ {s.docNumber} · ส่งเมื่อ {fmt(s.submittedAt)}
                        </div>
                      </div>
                      {s.hasImage && (
                        <button
                          onClick={() => viewImage(s.email)}
                          className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-txt hover:border-brand/60"
                        >
                          ดูรูปเอกสาร
                        </button>
                      )}
                    </div>

                    {reasonFor === s.email && (
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="เหตุผลที่ไม่ผ่าน (จะแสดงให้ผู้ใช้เห็น)"
                        className="mt-3 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-txt outline-none"
                      />
                    )}

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => decide(s.email, "approved")}
                        disabled={busy === s.email}
                        className="rounded-lg bg-up/90 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40"
                      >
                        อนุมัติ
                      </button>
                      {reasonFor === s.email ? (
                        <button
                          onClick={() => decide(s.email, "rejected")}
                          disabled={busy === s.email}
                          className="rounded-lg bg-down px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          ยืนยันปฏิเสธ
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setReasonFor(s.email);
                            setReason("");
                          }}
                          className="rounded-lg border border-down/50 px-3 py-1.5 text-xs text-down"
                        >
                          ปฏิเสธ
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {reviewed.length > 0 && (
            <section>
              <div className="mb-2 mt-4 text-xs font-medium text-muted">ตรวจแล้ว ({reviewed.length})</div>
              <ul className="space-y-1.5">
                {reviewed.map((s) => {
                  const st = STATUS_TH[s.status];
                  return (
                    <li
                      key={s.email}
                      className="flex items-center justify-between rounded-lg border border-line bg-bg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <span className="text-sm text-txt">{s.fullName}</span>
                        <span className="ml-2 text-[11px] text-muted">{s.email}</span>
                        {s.reason && <div className="text-[10px] text-down">เหตุผล: {s.reason}</div>}
                      </div>
                      <span className={`shrink-0 text-xs ${st?.cls}`}>{st?.th}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {image && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setImage(null)}
        >
          <div className="max-h-[85vh] max-w-lg overflow-auto rounded-xl border border-line bg-panel p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted">{image.email}</span>
              <button onClick={() => setImage(null)} className="text-xs text-brand">ปิด</button>
            </div>
            {image.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.src} alt="เอกสาร KYC" className="max-w-full rounded-lg" />
            ) : (
              <div className="py-10 text-center text-sm text-muted">กำลังโหลดรูป…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
