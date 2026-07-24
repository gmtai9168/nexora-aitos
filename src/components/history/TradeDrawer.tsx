"use client";

import { useMemo, useState } from "react";
import { EXIT_META, REGIME_META, SKIP_META, STRATEGY_META } from "@/lib/backtest-lab";
import { fmtCompact, fmtNum, fmtPrice } from "@/lib/format";
import {
  auditLog,
  LEDGER_BASE,
  postTradeReview,
  timeline,
  type LedgerRow,
} from "@/lib/trade-history";
import type { Candle } from "@/lib/types";
import { dtLong } from "./HistoryPanels";

const TABS = [
  { id: "detail", label: "รายละเอียด" },
  { id: "replay", label: "ย้อนเหตุการณ์" },
  { id: "review", label: "AI สรุปหลังปิด" },
  { id: "audit", label: "Audit Log" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line-soft py-[5px] last:border-0">
      <span className="shrink-0 text-[9.5px] text-muted">{label}</span>
      <span className={`num min-w-0 truncate text-right text-[10.5px] ${tone ?? "text-txt"}`}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-[10px] font-semibold text-brand">{title}</h3>
      <div className="rounded border border-line-soft bg-[#0a121a] px-2 py-1">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Replay chart
 * ------------------------------------------------------------------ */

function ReplayChart({ row, candles }: { row: LedgerRow; candles: Candle[] }) {
  const view = useMemo(() => {
    const t = row.trade;
    if (!t || candles.length < 5) return null;

    const entryIdx = candles.findIndex((c) => c.time >= t.entryTime);
    const exitIdx = candles.findIndex((c) => c.time >= t.exitTime);
    if (entryIdx < 0) return null;
    const end = exitIdx < 0 ? candles.length - 1 : exitIdx;

    const pad = Math.max(10, Math.round((end - entryIdx) * 0.9));
    const from = Math.max(0, entryIdx - pad);
    const to = Math.min(candles.length - 1, end + pad);
    const slice = candles.slice(from, to + 1);
    if (slice.length < 3) return null;

    const lo = Math.min(...slice.map((c) => c.low), t.stop, t.target);
    const hi = Math.max(...slice.map((c) => c.high), t.stop, t.target);
    const span = hi - lo || 1;
    const y = (v: number) => 100 - ((v - lo) / span) * 90 - 5;
    const w = 100 / slice.length;
    const xOf = (idx: number) => (idx - from) * w + w / 2;

    return {
      bars: slice.map((c, i) => ({
        x: i * w + w / 2,
        w: Math.max(w * 0.6, 0.4),
        top: y(c.high),
        bottom: y(c.low),
        openY: y(c.open),
        closeY: y(c.close),
        up: c.close >= c.open,
      })),
      entryX: xOf(entryIdx),
      exitX: xOf(end),
      entryY: y(t.entry),
      exitY: y(t.exit),
      stopY: y(t.stop),
      targetY: y(t.target),
      moves: t.stopMoves
        .map((m) => {
          const idx = candles.findIndex((c) => c.time >= m.time);
          return idx < 0 ? null : { x: xOf(idx), y: y(m.to) };
        })
        .filter((m): m is { x: number; y: number } => m !== null),
    };
  }, [row, candles]);

  if (!view) {
    return (
      <p className="rounded border border-line-soft bg-[#0a121a] px-2 py-6 text-center text-[10px] text-dim">
        ไม่มีแท่งเทียนพอสำหรับย้อนดูรายการนี้
      </p>
    );
  }

  return (
    <div className="rounded border border-line-soft bg-[#08111a] p-2">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[164px] w-full">
        <line x1="0" y1={view.targetY} x2="100" y2={view.targetY} stroke="#14e2a0" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={view.stopY} x2="100" y2={view.stopY} stroke="#ff4a68" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        {view.bars.map((b, i) => (
          <g key={i}>
            <line x1={b.x} y1={b.top} x2={b.x} y2={b.bottom} stroke={b.up ? "#14e2a0" : "#ff4a68"} strokeWidth="0.4" vectorEffect="non-scaling-stroke" opacity="0.7" />
            <rect
              x={b.x - b.w / 2}
              y={Math.min(b.openY, b.closeY)}
              width={b.w}
              height={Math.max(Math.abs(b.closeY - b.openY), 0.6)}
              fill={b.up ? "#14e2a0" : "#ff4a68"}
              opacity="0.75"
            />
          </g>
        ))}
        <line x1={view.entryX} y1="0" x2={view.entryX} y2="100" stroke="#00d4ff" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
        <line x1={view.exitX} y1="0" x2={view.exitX} y2="100" stroke="#ffb020" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
        {view.moves.map((m, i) => (
          <circle key={i} cx={m.x} cy={m.y} r="1" fill="#a78bfa" />
        ))}
        <circle cx={view.entryX} cy={view.entryY} r="1.5" fill="#00d4ff" />
        <circle cx={view.exitX} cy={view.exitY} r="1.5" fill="#ffb020" />
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[8.5px]">
        <span className="text-brand">▎เข้า</span>
        <span className="text-warn">▎ออก</span>
        <span className="text-up">- - เป้าหมาย</span>
        <span className="text-down">- - จุดตัดขาดทุน</span>
        {view.moves.length > 0 && <span className="text-[#a78bfa]">● ย้าย Stop</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Drawer
 * ------------------------------------------------------------------ */

export function TradeDrawer({
  row,
  candles,
  peers,
  onClose,
}: {
  row: LedgerRow;
  candles: Candle[];
  peers: LedgerRow[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>("detail");
  const t = row.trade;
  const review = useMemo(() => postTradeReview(row, peers), [row, peers]);
  const steps = useMemo(() => timeline(row), [row]);
  const audit = useMemo(() => auditLog(row), [row]);

  const win = (t?.pnlUsd ?? 0) > 0;

  return (
    <>
      <button
        type="button"
        aria-label="ปิดแผงรายละเอียด"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col border-l border-line bg-shell shadow-2xl">
        <header className="flex items-start gap-2 border-b border-line px-3 py-2.5">
          <span className="h-[34px] w-[3px] shrink-0 rounded" style={{ background: row.color }} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[13px] font-bold text-txt">{row.display}</h2>
              <span
                className={`rounded border px-1 py-[1px] text-[8.5px] font-semibold ${
                  row.side === "LONG"
                    ? "border-up/40 bg-[#0d2b23] text-up"
                    : "border-down/40 bg-[#2c1119] text-down"
                }`}
              >
                {row.side}
              </span>
              <span className="rounded border border-line bg-[#111e28] px-1 py-[1px] text-[8.5px] text-muted">
                {row.leverage}x {row.market === "futures" ? "Futures" : "Spot"}
              </span>
              <span className="rounded border border-warn/40 bg-[#20180a] px-1 py-[1px] text-[8.5px] text-warn">
                PAPER
              </span>
            </div>
            <p className="num truncate text-[9.5px] text-dim">
              {row.botName} · {STRATEGY_META[row.strategy].th} · {row.account}
            </p>
          </div>
          {t && (
            <div className="shrink-0 text-right">
              <div className={`num text-[15px] font-bold ${win ? "text-up" : "text-down"}`}>
                {t.pnlUsd >= 0 ? "+" : "−"}
                {fmtNum(Math.abs(t.pnlUsd))}
              </div>
              <div className={`num text-[9.5px] ${win ? "text-up/70" : "text-down/70"}`}>
                {t.r >= 0 ? "+" : ""}
                {t.r.toFixed(2)}R
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-line px-1.5 py-[2px] text-[11px] text-muted hover:text-txt"
          >
            ✕
          </button>
        </header>

        <nav className="flex gap-1 border-b border-line px-2 py-1.5">
          {TABS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setTab(x.id)}
              className={`rounded px-2 py-[4px] text-[10px] transition-colors ${
                tab === x.id ? "bg-brand text-black font-semibold" : "text-muted hover:bg-[#0f1c26]"
              }`}
            >
              {x.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
          {row.status === "rejected" && row.rejection && (
            <div className="rounded border border-warn/40 bg-[#20180a] px-2 py-1.5">
              <div className="text-[10.5px] font-semibold text-warn">
                คำสั่งนี้ถูกปฏิเสธ — ไม่ได้เปิดสถานะ
              </div>
              <p className="mt-[2px] text-[9.5px] leading-snug text-muted">
                เหตุผล: {SKIP_META[row.rejection.reason].th} · สัญญาณเดิม: {row.rejection.entryReason}
              </p>
            </div>
          )}

          {tab === "detail" && (
            <>
              <Section title="เหตุผลที่ AI เข้าเทรด">
                <p className="py-1 text-[10.5px] leading-relaxed text-muted">
                  {t?.entryReason ?? row.rejection?.entryReason ?? "—"}
                </p>
              </Section>

              {t && (
                <Section title={`คะแนนโหวตของคณะกรรมการ AI (${t.agree.length} เห็นด้วย / ${t.disagree.length} คัดค้าน)`}>
                  {t.agree.length + t.disagree.length === 0 ? (
                    <p className="py-1 text-[10px] text-dim">
                      ไม่มีโมเดลอื่นให้สัญญาณที่แท่งนี้ — เข้าจากสัญญาณของบอทเจ้าของกลยุทธ์เพียงตัวเดียว
                    </p>
                  ) : (
                    <ul className="space-y-[3px] py-1">
                      {t.agree.map((v) => (
                        <li key={`a-${v.kind}`} className="flex items-center gap-1.5 text-[10px]">
                          <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-up" />
                          <span className="min-w-0 flex-1 truncate text-muted">
                            {STRATEGY_META[v.kind].th}
                          </span>
                          <span className="num shrink-0 text-up">
                            เห็นด้วย · ความแรง {(v.strength * 100).toFixed(0)}%
                          </span>
                        </li>
                      ))}
                      {t.disagree.map((v) => (
                        <li key={`d-${v.kind}`} className="flex items-center gap-1.5 text-[10px]">
                          <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-down" />
                          <span className="min-w-0 flex-1 truncate text-muted">
                            {STRATEGY_META[v.kind].th}
                          </span>
                          <span className="num shrink-0 text-down">คัดค้าน · อ่านเป็น {v.dir}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              )}

              {t && (
                <Section title="Risk Engine อนุมัติเพราะ">
                  <Row label="มาร์จินที่ใช้" value={`${fmtNum(t.notional / t.leverage)} USDT`} />
                  <Row label="มูลค่าสถานะ" value={`${fmtNum(t.notional)} USDT`} />
                  <Row label="Leverage" value={`${t.leverage}x`} />
                  <Row
                    label="ระยะถึงจุดล้างพอร์ต"
                    value={`${(100 / t.leverage).toFixed(2)}%`}
                    tone={t.leverage >= 15 ? "text-warn" : "text-txt"}
                  />
                  <Row label="Margin Mode" value="Isolated" />
                </Section>
              )}

              <Section title="สภาพตลาดตอนเข้า">
                <Row
                  label="สภาวะตลาด"
                  value={REGIME_META[row.regime].th}
                  tone=""
                />
                {t && <Row label="ความผันผวน (ATR)" value={`${t.atrPctAtEntry.toFixed(2)}% ของราคา`} />}
                {t && <Row label="วอลุ่มแท่งสัญญาณ" value={fmtCompact(t.entryVolume)} />}
                {t && (
                  <Row
                    label="Funding ที่ใช้คำนวณ"
                    value={row.market === "futures" ? "0.01% ต่อ 8 ชม." : "ไม่มี (Spot)"}
                  />
                )}
                <Row label="Open Interest" value="ไม่มีข้อมูลย้อนหลังฟรี" tone="text-dim" />
              </Section>

              {t && (
                <Section title="ราคาเข้า / SL / TP เดิม">
                  <Row label="ราคาเข้า" value={fmtPrice(t.entry)} />
                  <Row label="Stop Loss เดิม" value={fmtPrice(t.stopMoves[0]?.from ?? t.stop)} tone="text-down" />
                  <Row label="Take Profit" value={fmtPrice(t.target)} tone="text-up" />
                  <Row label="ขนาด" value={`${fmtNum(t.qty, 6)} หน่วย`} />
                </Section>
              )}

              {t && t.stopMoves.length > 0 && (
                <Section title={`การปรับ Stop ระหว่างถือ (${t.stopMoves.length} ครั้ง)`}>
                  <ul className="space-y-[3px] py-1">
                    {t.stopMoves.map((m, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="num shrink-0 text-dim">{dtLong(m.time)}</span>
                        <span className="num text-muted">
                          {fmtPrice(m.from)} <span className="text-brand">→</span> {fmtPrice(m.to)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {t && (
                <Section title="ผลลัพธ์และต้นทุน">
                  <Row label="เหตุผลที่ปิด" value={EXIT_META[t.exitReason].th} />
                  <Row label="ราคาออก" value={fmtPrice(t.exit)} />
                  <Row label="กำไรก่อนหักต้นทุน" value={fmtNum(t.grossUsd)} tone={t.grossUsd >= 0 ? "text-up" : "text-down"} />
                  <Row label="ค่าธรรมเนียม (2 ข้าง)" value={`−${fmtNum(t.feeUsd)}`} tone="text-warn" />
                  <Row
                    label="Funding"
                    value={`${t.fundingUsd >= 0 ? "−" : "+"}${fmtNum(Math.abs(t.fundingUsd))}`}
                    tone={t.fundingUsd >= 0 ? "text-warn" : "text-up"}
                  />
                  <Row label="Slippage จริง (2 ข้าง)" value={`−${fmtNum(t.slippageUsd)}`} tone="text-warn" />
                  <Row
                    label="กำไรสุทธิ"
                    value={`${t.pnlUsd >= 0 ? "+" : "−"}${fmtNum(Math.abs(t.pnlUsd))}`}
                    tone={win ? "text-up" : "text-down"}
                  />
                  <Row label="กำไรสูงสุดระหว่างถือ" value={`${t.mfe.toFixed(2)}R`} tone="text-up/80" />
                  <Row label="ขาดทุนลึกสุดระหว่างถือ" value={`${t.mae.toFixed(2)}R`} tone="text-down/80" />
                  <Row label="เวลาถือครอง" value={`${t.holdBars} แท่ง · ${t.holdHours.toFixed(1)} ชม.`} />
                  <Row label="Latency การส่งคำสั่ง" value="ไม่มี — ไม่ได้ส่งคำสั่งจริง" tone="text-dim" />
                </Section>
              )}
            </>
          )}

          {tab === "replay" && (
            <>
              {t && <ReplayChart row={row} candles={candles} />}
              <Section title="ลำดับเหตุการณ์">
                <ol className="space-y-1.5 py-1">
                  {steps.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="num w-[86px] shrink-0 text-[9px] text-dim">
                        {dtLong(s.time)}
                      </span>
                      <span
                        className={`mt-[4px] h-[6px] w-[6px] shrink-0 rounded-full ${
                          s.tone === "up"
                            ? "bg-up"
                            : s.tone === "down"
                              ? "bg-down"
                              : s.tone === "warn"
                                ? "bg-warn"
                                : "bg-brand"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] font-semibold text-txt">
                          {s.actor}
                        </span>
                        <span className="block text-[9.5px] leading-snug text-muted">{s.text}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </Section>
              <p className="text-[9px] leading-snug text-dim">
                เวลาแสดงที่ความละเอียดของแท่งเทียน ({LEDGER_BASE.interval})
                เพราะการจำลองเดินตามแท่งที่ปิดแล้ว ไม่ได้เดินตามเวลาจริงระดับมิลลิวินาที —
                เหตุการณ์ที่เกิดในแท่งเดียวกันจึงมีเวลากำกับเท่ากัน
              </p>
            </>
          )}

          {tab === "review" && (
            <>
              {!review ? (
                <p className="py-8 text-center text-[10.5px] text-dim">
                  รายการนี้ไม่ได้เปิดสถานะ จึงไม่มีบทสรุปหลังปิด
                </p>
              ) : (
                <>
                  <p
                    className={`rounded border px-2 py-1.5 text-[10.5px] font-semibold ${
                      win ? "border-up/30 bg-[#0d2b23] text-up" : "border-down/30 bg-[#2c1119] text-down"
                    }`}
                  >
                    {review.verdict}
                  </p>

                  <Section title="สาเหตุของกำไร/ขาดทุน">
                    <p className="py-1 text-[10px] leading-relaxed text-muted">{review.cause}</p>
                  </Section>

                  <Section title="สิ่งที่ทำได้ดี">
                    {review.good.length === 0 ? (
                      <p className="py-1 text-[10px] text-dim">ไม่พบจุดที่โดดเด่นในไม้นี้</p>
                    ) : (
                      <ul className="space-y-[3px] py-1">
                        {review.good.map((g, i) => (
                          <li key={i} className="flex gap-1.5 text-[10px] leading-snug text-muted">
                            <span className="text-up">·</span>
                            <span className="min-w-0">{g}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section title="จุดที่ผิดพลาด">
                    {review.bad.length === 0 ? (
                      <p className="py-1 text-[10px] text-dim">ไม่พบข้อผิดพลาดที่มีนัยสำคัญ</p>
                    ) : (
                      <ul className="space-y-[3px] py-1">
                        {review.bad.map((b, i) => (
                          <li key={i} className="flex gap-1.5 text-[10px] leading-snug text-muted">
                            <span className="text-down">·</span>
                            <span className="min-w-0">{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section title="ควรปรับ Entry หรือ Exit หรือไม่">
                    {review.entryExit.length === 0 ? (
                      <p className="py-1 text-[10px] text-dim">
                        จุดเข้าและจุดออกทำงานตามแผน ไม่มีข้อเสนอปรับ
                      </p>
                    ) : (
                      <ul className="space-y-[3px] py-1">
                        {review.entryExit.map((e, i) => (
                          <li key={i} className="flex gap-1.5 text-[10px] leading-snug text-muted">
                            <span className="text-brand">·</span>
                            <span className="min-w-0">{e}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section title="ควรปรับ Leverage หรือไม่">
                    <p className="py-1 text-[10px] leading-relaxed text-muted">{review.leverage}</p>
                  </Section>

                  <Section title="กลยุทธ์นี้ยังเหมาะกับตลาดปัจจุบันหรือไม่">
                    <p className="py-1 text-[10px] leading-relaxed text-muted">{review.strategyFit}</p>
                  </Section>

                  <p className="text-[9px] leading-snug text-dim">
                    ทุกประโยคด้านบนคำนวณจากค่าที่บันทึกไว้ในไม้นี้โดยตรง (MFE, MAE, ต้นทุน,
                    เสียงโหวต, การย้าย Stop, สถิติของบอทในสภาวะเดียวกัน) — ไม่มีการเรียกโมเดลภาษาภายนอก
                  </p>
                </>
              )}
            </>
          )}

          {tab === "audit" && (
            <>
              <Section title="บันทึกการตรวจสอบ">
                <ol className="space-y-1.5 py-1">
                  {audit.map((a, i) => (
                    <li key={i} className="border-b border-line-soft pb-1.5 last:border-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`num text-[9.5px] font-bold ${
                            a.action === "REJECT"
                              ? "text-down"
                              : a.action === "APPROVE"
                                ? "text-up"
                                : a.action === "MODIFY_SL"
                                  ? "text-warn"
                                  : "text-brand"
                          }`}
                        >
                          {a.action}
                        </span>
                        <span className="num shrink-0 text-[9px] text-dim">{dtLong(a.time)}</span>
                      </div>
                      <div className="truncate text-[10px] text-txt">{a.actor}</div>
                      <div className="text-[9.5px] leading-snug text-muted">{a.detail}</div>
                    </li>
                  ))}
                </ol>
              </Section>
              <p className="text-[9px] leading-snug text-dim">
                ไม่มีรายการใดที่ส่งโดยมนุษย์ — แพลตฟอร์มนี้ไม่เปิดให้ผู้ใช้ส่งคำสั่งเอง
                และไม่รับ API Key ของกระดานเทรด ทุกบรรทัดจึงมีผู้กระทำเป็นบอท AI พร้อมรหัสประจำตัว
              </p>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
