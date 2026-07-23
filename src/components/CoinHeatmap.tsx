"use client";

import { useEffect, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import { badgeText, findListing } from "@/lib/universe";
import { Panel } from "./Panel";

const COINS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "LINKUSDT",
];

type Row = { symbol: string; funding: number | null; oiChangePct: number | null };

/** Blends the four live readings into one 0-100 score. */
function aiScore(
  changePct: number,
  rangePos: number,
  funding: number | null,
  oiChange: number | null,
) {
  const trend = Math.max(0, Math.min(100, 50 + changePct * 8));
  const momentum = Math.max(0, Math.min(100, rangePos * 100));
  // Crowded longs (high positive funding) are treated as a negative.
  const fund = funding === null ? 50 : Math.max(0, Math.min(100, 50 - funding * 900));
  const oi = oiChange === null ? 50 : Math.max(0, Math.min(100, 50 + oiChange * 12));
  return Math.round(trend * 0.4 + momentum * 0.25 + fund * 0.15 + oi * 0.2);
}

export function CoinHeatmap() {
  const { quotes, setSymbol, symbol } = useMarket();
  const [extra, setExtra] = useState<Map<string, Row>>(new Map());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const res = await fetch(`/api/funding?symbols=${COINS.join(",")}`);
        const data: { rates: { symbol: string; rate: number }[] } = await res.json();
        if (!cancelled) {
          setExtra((prev) => {
            const next = new Map(prev);
            for (const r of data.rates) {
              next.set(r.symbol, {
                symbol: r.symbol,
                funding: r.rate,
                oiChangePct: prev.get(r.symbol)?.oiChangePct ?? null,
              });
            }
            return next;
          });
        }
      } catch {
        /* keep the last board */
      }
      if (!cancelled) timer = setTimeout(load, 60000);
    };

    timer = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <Panel
      title="แผนที่ความร้อนเหรียญ"
      titleEn="Coin Heatmap"
      right={<span className="text-[9px] text-dim">เรียลไทม์</span>}
      bodyClassName="p-2"
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-7">
        {COINS.map((s) => {
          const q = quotes.get(s);
          const l = findListing(s);
          const row = extra.get(s);
          const rangePos =
            q && q.high > q.low ? (q.price - q.low) / (q.high - q.low) : 0.5;
          const score = q
            ? aiScore(q.changePct, rangePos, row?.funding ?? null, row?.oiChangePct ?? null)
            : 50;
          const bull = (q?.changePct ?? 0) >= 0;
          const intensity = Math.min(1, Math.abs(q?.changePct ?? 0) / 6);

          return (
            <button
              key={s}
              type="button"
              onClick={() => setSymbol(s)}
              className={`rounded border px-2 py-1.5 text-left transition-transform hover:scale-[1.02] ${
                symbol === s ? "ring-1 ring-brand/60" : ""
              }`}
              style={{
                background: bull
                  ? `rgba(20,226,160,${0.08 + intensity * 0.28})`
                  : `rgba(255,74,104,${0.08 + intensity * 0.28})`,
                borderColor: bull
                  ? "rgba(20,226,160,0.35)"
                  : "rgba(255,74,104,0.35)",
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="grid size-[14px] shrink-0 place-items-center rounded-full text-[7.5px] font-bold text-black"
                  style={{ background: l?.color ?? "#6b8497" }}
                >
                  {l ? badgeText(l) : "?"}
                </span>
                <span className="truncate text-[10.5px] font-semibold">
                  {s.replace("USDT", "")}
                </span>
                <span
                  className={`num ml-auto text-[10px] font-bold ${bull ? "text-up" : "text-down"}`}
                >
                  {q ? fmtPct(q.changePct) : "—"}
                </span>
              </div>

              <div className="num mt-0.5 text-[11px] text-txt">
                {q ? fmtPrice(q.price) : "—"}
              </div>

              <dl className="mt-1 space-y-[1px] text-[8.5px] text-dim">
                <div className="flex justify-between">
                  <dt>Momentum</dt>
                  <dd className="num text-muted">{(rangePos * 100).toFixed(0)}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Funding</dt>
                  <dd
                    className={`num ${(row?.funding ?? 0) >= 0 ? "text-up" : "text-down"}`}
                  >
                    {row?.funding === undefined || row?.funding === null
                      ? "—"
                      : `${row.funding.toFixed(3)}%`}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Volume</dt>
                  <dd className="num text-muted">
                    {q ? fmtCompact(q.quoteVolume) : "—"}
                  </dd>
                </div>
              </dl>

              <div className="mt-1 flex items-center gap-1">
                <span className="text-[8.5px] text-dim">AI</span>
                <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-black/40">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${score}%`,
                      background: score >= 60 ? "#14e2a0" : score >= 40 ? "#ffb020" : "#ff4a68",
                    }}
                  />
                </span>
                <span className="num text-[9px] font-bold text-txt">{score}</span>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
