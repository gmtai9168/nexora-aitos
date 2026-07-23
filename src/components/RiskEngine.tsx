"use client";

import { useMemo } from "react";
import { buildBook, riskRows } from "@/lib/book";
import { useMarket } from "@/lib/market-context";
import { Panel, Tag } from "./Panel";
import { ArcGauge } from "./viz";

export function RiskEngine() {
  const { quotes, regime } = useMarket();
  const book = useMemo(() => buildBook(quotes), [quotes]);
  const rows = useMemo(() => riskRows(book, regime.atr), [book, regime.atr]);

  const safe = book.marginRatio < 40 && book.dayPnlPct > -1.6;

  return (
    <Panel title="ความเสี่ยงระบบ" titleEn="Risk Engine" bodyClassName="p-3">
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <ArcGauge
            value={book.marginRatio}
            max={100}
            size={148}
            label={`${book.marginRatio.toFixed(2)}%`}
            sub="Margin Ratio"
          />
        </div>

        <div className="min-w-0 flex-1">
          {rows.map((r) => (
            <div
              key={r.en}
              className="flex items-center justify-between gap-2 border-b border-line-soft py-[5px] last:border-0"
            >
              <span className="min-w-0 truncate text-[10.5px] text-muted">
                {r.th}
              </span>
              <span
                className={`num shrink-0 text-[11px] font-semibold ${
                  r.tone === "up"
                    ? "text-up"
                    : r.tone === "warn"
                      ? "text-warn"
                      : r.tone === "down"
                        ? "text-down"
                        : "text-txt"
                }`}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2 border-t border-line-soft pt-2.5">
        <span className="text-[10.5px] text-muted">สถานะ:</span>
        {safe ? <Tag tone="up">ปลอดภัย ✓</Tag> : <Tag tone="warn">เฝ้าระวัง !</Tag>}
        <span className="ml-auto text-[9.5px] text-dim">
          ATR {regime.atr.toFixed(2)}% · {regime.volatilityTh}
        </span>
      </div>
    </Panel>
  );
}
