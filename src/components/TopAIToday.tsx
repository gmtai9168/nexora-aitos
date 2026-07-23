"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtPct } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import { findListing } from "@/lib/universe";
import { Panel } from "./Panel";
import { Sparkline } from "./viz";

/** Each AI is scored by the live 24h move of the pair it specialises in. */
const ROSTER = [
  { id: "trend", name: "Trend Hunter", th: "ล่าเทรนด์", symbol: "BTCUSDT", side: 1 },
  { id: "flow", name: "Order Flow", th: "ออร์เดอร์โฟลว์", symbol: "ETHUSDT", side: 1 },
  { id: "whale", name: "Whale AI", th: "ติดตามวาฬ", symbol: "SOLUSDT", side: 1 },
  { id: "funding", name: "Funding AI", th: "ค่าธรรมเนียม", symbol: "BNBUSDT", side: -1 },
  { id: "breakout", name: "Breakout AI", th: "เบรกเอาต์", symbol: "XRPUSDT", side: 1 },
];

const SYMBOLS = ROSTER.map((r) => r.symbol);

export function TopAIToday() {
  const { quotes, setSymbol } = useMarket();
  const [series, setSeries] = useState<Record<string, number[]>>({});

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const res = await fetch(`/api/sparks?symbols=${SYMBOLS.join(",")}`);
        const data: { series: Record<string, number[]> } = await res.json();
        if (!cancelled) setSeries(data.series ?? {});
      } catch {
        /* the percentage still carries the ranking */
      }
      if (!cancelled) timer = setTimeout(load, 120000);
    };

    timer = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const ranked = useMemo(
    () =>
      ROSTER.map((r) => {
        const pnl = (quotes.get(r.symbol)?.changePct ?? 0) * r.side;
        return {
          ...r,
          pnl,
          curve: (series[r.symbol] ?? []).map((v) => v * r.side),
          listing: findListing(r.symbol),
        };
      }).sort((a, b) => b.pnl - a.pnl),
    [quotes, series],
  );

  return (
    <Panel
      title="AI ทำผลงานดีสุดวันนี้"
      titleEn="Top AI Today"
      right={<span className="text-[9px] text-dim">24H</span>}
      bodyClassName="p-0"
    >
      <ol className="divide-y divide-line-soft">
        {ranked.map((r, i) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSymbol(r.symbol)}
              className="flex w-full items-center gap-2 px-3 py-[7px] text-left hover:bg-[#0e1a24]"
            >
              <span
                className={`num grid size-[16px] shrink-0 place-items-center rounded text-[9px] font-bold ${
                  i === 0 ? "bg-brand text-black" : "bg-[#16242f] text-muted"
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px]">{r.name}</span>
                <span className="block truncate text-[9px] text-dim">
                  {r.th} · {r.listing?.display}
                </span>
              </span>
              <span className="w-[46px] shrink-0">
                <Sparkline
                  values={r.curve}
                  height={20}
                  stroke={r.pnl >= 0 ? "#14e2a0" : "#ff4a68"}
                  fill={false}
                />
              </span>
              <span
                className={`num w-[50px] shrink-0 text-right text-[11px] font-bold ${
                  r.pnl >= 0 ? "text-up" : "text-down"
                }`}
              >
                {fmtPct(r.pnl)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
