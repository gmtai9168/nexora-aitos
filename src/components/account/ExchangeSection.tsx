"use client";

import { useCallback, useEffect, useState } from "react";

type Conn = { exchange: string; apiKeyMasked: string; scope: string; label?: string; createdAt: number };

const EXCHANGES = [
  { id: "binance", name: "Binance" },
  { id: "bybit", name: "Bybit" },
  { id: "okx", name: "OKX" },
];

export function ExchangeSection() {
  const [conns, setConns] = useState<Conn[]>([]);
  const [canStore, setCanStore] = useState(true);
  const [exchange, setExchange] = useState("binance");
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch("/api/account/exchange")
      .then((r) => r.json())
      .then((d) => {
        setConns(d.connections ?? []);
        setCanStore(d.canStore !== false);
      })
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function save() {
    setBusy(true);
    setError("");
    const r = await fetch("/api/account/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exchange, apiKey, secret, scope: "trade-only", label }),
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(
        d.error === "encryption_unavailable"
          ? "ยังตั้งค่า ENCRYPTION_KEY ไม่ครบ — เก็บคีย์อย่างปลอดภัยไม่ได้"
          : "ข้อมูลไม่ถูกต้อง (ตรวจ API key/secret)",
      );
      return;
    }
    setApiKey("");
    setSecret("");
    setLabel("");
    load();
  }

  async function remove(ex: string) {
    await fetch(`/api/account/exchange?exchange=${ex}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
        ⚠️ การเชื่อม API นี้ <b>ยังไม่เปิดการเทรดด้วยเงินจริง</b> — ระบบยังทำงานแบบ PAPER/ทดลองเท่านั้น
        คีย์จะถูกเข้ารหัสเก็บไว้ และการเปิดเทรดจริงจะเป็นขั้นตอนแยกที่คุณต้องยืนยันเองในอนาคต
      </p>

      {!canStore && (
        <p className="rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-xs text-down">
          ยังตั้งค่า <code>ENCRYPTION_KEY</code> บนเซิร์ฟเวอร์ไม่ครบ — ระบบจะไม่ยอมเก็บ secret จนกว่าจะเข้ารหัสได้อย่างปลอดภัย
        </p>
      )}

      {conns.length > 0 && (
        <ul className="space-y-2">
          {conns.map((c) => (
            <li key={c.exchange} className="flex items-center justify-between rounded-lg border border-line bg-bg px-3 py-2">
              <div>
                <div className="text-sm text-txt">
                  {EXCHANGES.find((e) => e.id === c.exchange)?.name ?? c.exchange}
                  {c.label && <span className="text-muted"> · {c.label}</span>}
                </div>
                <div className="text-[11px] text-muted">
                  key {c.apiKeyMasked} · {c.scope} · เชื่อมแล้ว (PAPER)
                </div>
              </div>
              <button onClick={() => remove(c.exchange)} className="text-xs text-down hover:underline">
                ลบ
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-lg border border-line bg-bg p-3">
        <div className="text-xs font-medium text-txt">เชื่อม Exchange ใหม่</div>
        <select
          value={exchange}
          onChange={(e) => setExchange(e.target.value)}
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-txt outline-none"
        >
          {EXCHANGES.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key"
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-txt outline-none"
        />
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="API Secret"
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-txt outline-none"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ชื่อเรียก (ไม่บังคับ)"
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-txt outline-none"
        />
        {error && <div className="text-xs text-down">{error}</div>}
        <button
          onClick={save}
          disabled={busy || !canStore || apiKey.length < 8 || secret.length < 8}
          className="w-full rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40"
        >
          {busy ? "กำลังบันทึก…" : "บันทึกการเชื่อมต่อ (Trade-Only · ยัง PAPER)"}
        </button>
        <p className="text-[10px] text-dim">
          แนะนำ: สร้าง API key แบบจำกัดสิทธิ์ ปิดการถอนเงิน (withdraw) เสมอ
        </p>
      </div>
    </div>
  );
}
