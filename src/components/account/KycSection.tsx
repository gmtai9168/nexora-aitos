"use client";

import { useCallback, useEffect, useState } from "react";

type Sub = {
  status: "none" | "pending" | "approved" | "rejected";
  fullName?: string;
  docType?: string;
  reason?: string;
};

const STATUS: Record<string, { th: string; cls: string }> = {
  pending: { th: "กำลังตรวจสอบ", cls: "text-warn" },
  approved: { th: "ยืนยันแล้ว", cls: "text-up" },
  rejected: { th: "ไม่ผ่าน", cls: "text-down" },
};

export function KycSection({ onChange }: { onChange: () => void }) {
  const [sub, setSub] = useState<Sub | null>(null);
  const [fullName, setFullName] = useState("");
  const [docType, setDocType] = useState("id_card");
  const [docNumber, setDocNumber] = useState("");
  const [docImage, setDocImage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch("/api/account/kyc")
      .then((r) => r.json())
      .then((d) => setSub(d.submission ?? null))
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 550_000) {
      setError("ไฟล์ใหญ่เกินไป (จำกัด ~500KB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDocImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function submit() {
    setBusy(true);
    setError("");
    const r = await fetch("/api/account/kyc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, docType, docNumber, docImage }),
    });
    setBusy(false);
    if (!r.ok) {
      setError("ข้อมูลไม่ครบหรือไม่ถูกต้อง");
      return;
    }
    load();
    onChange();
  }

  const status = sub?.status ?? "none";
  const info = STATUS[status];

  if (status === "approved" || status === "pending") {
    return (
      <div className="space-y-1">
        <div className={`text-sm ${info.cls}`}>สถานะ KYC: {info.th}</div>
        {status === "pending" && <p className="text-xs text-muted">ทีมงานกำลังตรวจสอบเอกสารของคุณ</p>}
        {status === "approved" && <p className="text-xs text-muted">บัญชีของคุณผ่านการยืนยันตัวตนแล้ว</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {status === "rejected" && (
        <div className="rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-xs text-down">
          การยืนยันครั้งก่อนไม่ผ่าน{sub?.reason ? ` — ${sub.reason}` : ""} · กรุณาส่งใหม่
        </div>
      )}
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="ชื่อ-นามสกุล (ตามเอกสาร)"
        className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-txt outline-none"
      />
      <div className="flex gap-2">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-txt outline-none"
        >
          <option value="id_card">บัตรประชาชน</option>
          <option value="passport">พาสปอร์ต</option>
          <option value="driver_license">ใบขับขี่</option>
        </select>
        <input
          value={docNumber}
          onChange={(e) => setDocNumber(e.target.value)}
          placeholder="เลขที่เอกสาร"
          className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-txt outline-none"
        />
      </div>
      <label className="block text-xs text-muted">
        รูปเอกสาร (ไม่บังคับ · ≤500KB)
        <input type="file" accept="image/*" onChange={onFile} className="mt-1 block w-full text-xs text-muted" />
      </label>
      {docImage && <div className="text-[11px] text-up">แนบรูปแล้ว</div>}
      {error && <div className="text-xs text-down">{error}</div>}
      <button
        onClick={submit}
        disabled={busy || fullName.length < 2 || docNumber.length < 3}
        className="w-full rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40"
      >
        {busy ? "กำลังส่ง…" : "ส่งยืนยันตัวตน"}
      </button>
      <p className="text-[10px] text-dim">ข้อมูลใช้เพื่อยืนยันตัวตนเท่านั้น · เก็บอย่างปลอดภัย</p>
    </div>
  );
}
