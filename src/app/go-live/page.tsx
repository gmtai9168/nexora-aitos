"use client";

import { useCallback, useEffect, useState } from "react";
import type { Readiness } from "@/lib/readiness";

type Stats = {
  totalClosed: number;
  totalWins: number;
  totalPnl: number;
  balance: number | null;
  armed: boolean;
  symbols: string[];
  updatedAt: number;
};

export default function GoLivePage() {
  const [data, setData] = useState<{ readiness: Readiness; stats: Stats } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/ai/readiness")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const r = data?.readiness;
  const s = data?.stats;

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">✓</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">ความพร้อมสำหรับเทรดจริง</h1>
          <p className="text-[10.5px] text-dim">
            Go-Live Checklist · ประเมินจากผลเทรดจริงบน Testnet ว่ากลยุทธ์พร้อมเสี่ยงเงินจริงหรือยัง
          </p>
        </span>
        <button onClick={load} className="ml-auto text-xs text-brand hover:underline">
          รีเฟรช
        </button>
      </header>

      {loading || !r || !s ? (
        <div className="py-16 text-center text-sm text-muted">กำลังคำนวณจากสถิติจริง…</div>
      ) : (
        <>
          {/* Verdict */}
          <section
            className={`rounded-2xl border p-5 ${
              r.ready ? "border-up/50 bg-up/10" : "border-warn/40 bg-warn/10"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="relative grid size-[84px] shrink-0 place-items-center">
                <svg viewBox="0 0 36 36" className="size-[84px] -rotate-90">
                  <circle cx="18" cy="18" r="15.5" stroke="#16242f" strokeWidth="3.5" fill="none" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    stroke={r.ready ? "#14e2a0" : "#ffb020"}
                    strokeWidth="3.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${(r.score / 100) * 97.4} 97.4`}
                  />
                </svg>
                <span className="absolute num text-[18px] font-bold text-txt">{r.score}%</span>
              </div>
              <div className="min-w-0">
                <div className={`text-lg font-bold ${r.ready ? "text-up" : "text-warn"}`}>
                  {r.ready ? "ผ่านเกณฑ์ทุกข้อ" : "ยังไม่พร้อมเทรดจริง"}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  ผ่าน {r.passed} / {r.total} ข้อ
                  {r.tradesRemaining > 0 && ` · ต้องเทรดทดสอบอีกอย่างน้อย ${r.tradesRemaining} ไม้`}
                </div>
              </div>
            </div>
          </section>

          {/* Honesty banner */}
          <div className="rounded-lg border border-down/40 bg-down/10 px-3 py-2.5 text-[11px] leading-relaxed text-down">
            ⚠️ <b>ระบบยังทำงานแบบ PAPER/Testnet</b> — checklist นี้เป็นเพียงตัวประเมิน ไม่ได้เปิดการเทรดเงินจริง
            ต่อให้ผ่านครบทุกข้อ การใช้เงินจริงยังเป็นการตัดสินใจของคุณ และควรเริ่มด้วย
            <b> เงินก้อนเล็กที่ leverage 5x (ขั้นต่ำที่ตั้งไว้)</b> เพื่อทดสอบ slippage/funding จริงก่อนค่อยเพิ่มขนาด
          </div>

          {/* Checklist */}
          <section className="space-y-2">
            {r.checks.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-panel p-3.5"
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
                    c.pass ? "bg-up/15 text-up" : "bg-warn/15 text-warn"
                  }`}
                >
                  {c.pass ? "✓" : "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-txt">{c.label}</div>
                  <div className="text-[11px] text-muted">
                    ปัจจุบัน <span className="num text-txt">{c.current}</span> · เป้า{" "}
                    <span className="num">{c.target}</span>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-right text-[11px] ${c.pass ? "text-up" : "text-warn"}`}
                >
                  {c.detail}
                </span>
              </div>
            ))}
          </section>

          {/* Live stats footer */}
          <section className="rounded-2xl border border-line bg-panel p-4">
            <div className="mb-2 text-xs font-semibold text-txt">สถิติจริงตอนนี้ (Testnet)</div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[10px] text-dim">ปิดแล้ว</dt>
                <dd className="num text-txt">{s.totalClosed} ไม้</dd>
              </div>
              <div>
                <dt className="text-[10px] text-dim">ชนะ</dt>
                <dd className="num text-txt">{s.totalWins} ไม้</dd>
              </div>
              <div>
                <dt className="text-[10px] text-dim">กำไรสะสม</dt>
                <dd className={`num ${s.totalPnl >= 0 ? "text-up" : "text-down"}`}>
                  {s.totalPnl >= 0 ? "+" : ""}
                  {s.totalPnl.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] text-dim">ยอดเงิน</dt>
                <dd className="num text-txt">{s.balance != null ? s.balance.toFixed(0) : "—"}</dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center gap-2 text-[11px]">
              <span className={`size-1.5 rounded-full ${s.armed ? "bg-up dot-live" : "bg-down"}`} />
              <span className="text-muted">
                {s.armed ? "AI กำลังเทรดทดสอบอยู่" : "AI หยุดอยู่"} · เทรด {s.symbols.length} เหรียญ
              </span>
            </div>
          </section>

          <p className="text-center text-[10px] text-dim">
            Profit Factor และ Max Drawdown เริ่มเก็บข้อมูลแบบละเอียดตั้งแต่รอบอัปเดตนี้ —
            ตัวเลขจะแม่นขึ้นเมื่อมีไม้ใหม่ปิดเพิ่ม
          </p>
        </>
      )}
    </div>
  );
}
