"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import type { AssetClass, Quote } from "@/lib/types";
import { CRYPTO, GLOBAL_STOCKS, TH_STOCKS, badgeText, type Listing } from "@/lib/universe";
import { IconSearch, IconStar } from "../icons";
import { Panel } from "../Panel";

const TABS: { key: AssetClass; th: string; en: string; list: Listing[] }[] = [
  { key: "crypto", th: "คริปโต", en: "Crypto", list: CRYPTO },
  { key: "th", th: "หุ้นไทย", en: "SET", list: TH_STOCKS },
  { key: "global", th: "ต่างประเทศ", en: "Global", list: GLOBAL_STOCKS },
];

const WATCH_KEY = "aitos.watchlist";

/**
 * A quick screen-level AI Score. The full nine-factor model needs per-symbol
 * futures and on-chain feeds, so the table uses the three factors available
 * for every row at once: trend, position in the day range, and turnover.
 */
function quickScore(q: Quote | undefined): number {
  if (!q) return 50;
  const trend = Math.max(0, Math.min(100, 50 + q.changePct * 7));
  const range =
    q.high > q.low ? ((q.price - q.low) / (q.high - q.low)) * 100 : 50;
  const turnover = Math.max(0, Math.min(100, Math.log10(Math.max(q.quoteVolume, 1)) * 11));
  return Math.round(trend * 0.5 + range * 0.3 + turnover * 0.2);
}

export function TopCoinsTable() {
  const { quotes, symbol, setSymbol } = useMarket();
  const [tab, setTab] = useState<AssetClass>("crypto");
  const [query, setQuery] = useState("");
  const [watch, setWatch] = useState<string[]>([]);
  const [rows, setRows] = useState<Map<string, Quote>>(new Map());

  const listings = useMemo(() => TABS.find((t) => t.key === tab)!.list, [tab]);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = localStorage.getItem(WATCH_KEY);
        if (raw) setWatch(JSON.parse(raw));
      } catch {
        /* empty watchlist is fine */
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // The shared context already polls crypto; stock tabs need their own fetch.
  useEffect(() => {
    if (tab === "crypto") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/quotes?symbols=${encodeURIComponent(listings.map((l) => l.symbol).join(","))}`,
        );
        const data: { quotes: Quote[] } = await res.json();
        if (!cancelled) setRows(new Map(data.quotes.map((q) => [q.symbol, q])));
      } catch {
        /* keep the last board */
      }
      if (!cancelled) timer = setTimeout(load, 30000);
    };

    timer = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tab, listings]);

  const board = tab === "crypto" ? quotes : rows;

  const toggleWatch = (s: string) => {
    setWatch((prev) => {
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
      try {
        localStorage.setItem(WATCH_KEY, JSON.stringify(next));
      } catch {
        /* non-fatal */
      }
      return next;
    });
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listings
      .filter(
        (l) =>
          !q ||
          l.display.toLowerCase().includes(q) ||
          l.name.toLowerCase().includes(q) ||
          (l.nameTh ?? "").includes(query.trim()),
      )
      .map((l) => ({ listing: l, quote: board.get(l.symbol), score: quickScore(board.get(l.symbol)) }))
      .sort((a, b) => b.score - a.score);
  }, [listings, query, board]);

  return (
    <Panel
      title="เหรียญเด่นตามคะแนน AI"
      titleEn="Top by AI Score"
      right={
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded px-1.5 py-[2px] text-[9.5px] transition-colors ${
                tab === t.key
                  ? "bg-brand text-black"
                  : "text-muted hover:bg-[#0f1c26] hover:text-txt"
              }`}
            >
              {t.th}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-0 flex flex-col"
    >
      <label className="chip mx-2 mt-2 flex items-center gap-1.5 px-2 py-[4px]">
        <IconSearch size={12} className="shrink-0 text-dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาสินทรัพย์…"
          className="w-full bg-transparent text-[10.5px] text-txt outline-none placeholder:text-dim"
        />
      </label>

      <div className="mt-1 max-h-[430px] overflow-y-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-panel">
            <tr className="text-[9px] uppercase tracking-wide text-dim">
              <th className="px-2 py-1.5 font-medium">#</th>
              <th className="px-1 py-1.5 font-medium">สินทรัพย์</th>
              <th className="px-2 py-1.5 text-right font-medium">ราคา</th>
              <th className="px-2 py-1.5 text-right font-medium">24H</th>
              <th className="px-2 py-1.5 text-right font-medium">AI Score</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const active = symbol === r.listing.symbol;
              const starred = watch.includes(r.listing.symbol);
              return (
                <tr
                  key={r.listing.symbol}
                  onClick={() => setSymbol(r.listing.symbol)}
                  className={`cursor-pointer border-t border-line-soft text-[10.5px] hover:bg-[#0e1a24] ${
                    active ? "bg-[#0e1f26]" : ""
                  }`}
                >
                  <td className="px-2 py-[6px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWatch(r.listing.symbol);
                      }}
                      aria-label="รายการโปรด"
                      className={starred ? "text-warn" : "text-[#243744] hover:text-muted"}
                    >
                      {starred ? <IconStar size={11} /> : <span className="num">{i + 1}</span>}
                    </button>
                  </td>
                  <td className="px-1 py-[6px]">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="grid size-[15px] shrink-0 place-items-center rounded-full text-[7.5px] font-bold text-black"
                        style={{ background: r.listing.color }}
                      >
                        {badgeText(r.listing)}
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate font-medium">
                          {r.listing.display}
                        </span>
                        <span className="block truncate text-[8.5px] text-dim">
                          {r.listing.nameTh ?? r.listing.name}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="num px-2 py-[6px] text-right">
                    {r.quote ? fmtPrice(r.quote.price) : "—"}
                  </td>
                  <td
                    className={`num px-2 py-[6px] text-right ${
                      (r.quote?.changePct ?? 0) >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {r.quote ? fmtPct(r.quote.changePct) : "—"}
                  </td>
                  <td className="px-2 py-[6px]" title={r.quote ? `มูลค่าซื้อขาย ${fmtCompact(r.quote.quoteVolume)}` : ""}>
                    <span className="flex items-center justify-end gap-1.5">
                      <span className="h-[4px] w-8 overflow-hidden rounded-full bg-[#16242f]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${r.score}%`,
                            background:
                              r.score >= 65 ? "#14e2a0" : r.score >= 45 ? "#ffb020" : "#ff4a68",
                          }}
                        />
                      </span>
                      <span
                        className="num w-[18px] text-right text-[11px] font-bold"
                        style={{
                          color:
                            r.score >= 65 ? "#14e2a0" : r.score >= 45 ? "#ffb020" : "#ff4a68",
                        }}
                      >
                        {r.score}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-line-soft px-2.5 py-1.5 text-[9px] text-dim">
        คะแนนในตารางเป็นคะแนนคัดกรองเร็ว (เทรนด์ 50% · ตำแหน่งในกรอบวัน 30% · มูลค่าซื้อขาย 20%)
        — คลิกเพื่อให้ AI วิเคราะห์เต็มรูปแบบ 9 ปัจจัย
      </p>
    </Panel>
  );
}
