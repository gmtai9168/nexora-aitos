"use client";

import { useMemo } from "react";
import { GROUP_BY_KEY } from "@/lib/agents";
import { bkkTime } from "@/lib/format";
import { useMarket, useNow } from "@/lib/market-context";
import { Panel, Tag } from "../Panel";

type Entry = { at: number; group: string; who: string; what: string };

/**
 * Flight recorder. Every line is written from the state the app actually holds
 * — the feed timestamp, the measured regime, the live evidence and the final
 * call — laid out in pipeline order back from the last poll.
 */
export function TimelinePanel() {
  const { lastUpdate, regime, decision, context, exchanges, connected } = useMarket();
  const now = useNow(5000);

  const entries = useMemo<Entry[]>(() => {
    if (!lastUpdate || now === null) return [];

    const t = lastUpdate;
    const step = 1200;
    const venue = exchanges.find((e) => e.online);

    const rows: Entry[] = [
      {
        at: t - step * 6,
        group: "data",
        who: "Market Data AI",
        what: connected
          ? `รับราคาจาก ${venue?.name ?? "Exchange"} · ${venue?.latency ?? "—"} ms`
          : "ฟีดขาดการเชื่อมต่อ",
      },
      {
        at: t - step * 5,
        group: "data",
        who: "OrderBook AI",
        what: "อัปเดตสมุดคำสั่งและความลึกสองฝั่ง",
      },
      {
        at: t - step * 4,
        group: "trend",
        who: "Macro Trend AI",
        what: `${regime.label} · ${regime.biasTh} · RSI ${regime.rsi.toFixed(1)}`,
      },
      {
        at: t - step * 3,
        group: "smart",
        who: "Whale AI",
        what:
          context.whaleBuyShare === null
            ? "ไม่มีข้อมูลไม้ใหญ่"
            : `ไม้ใหญ่ฝั่งซื้อ ${context.whaleBuyShare.toFixed(1)}%`,
      },
      {
        at: t - step * 2,
        group: "futures",
        who: "Open Interest AI",
        what:
          context.oiChangePct === null
            ? "ไม่มีข้อมูล OI"
            : `OI ${context.oiChangePct >= 0 ? "+" : ""}${context.oiChangePct.toFixed(2)}% ใน 1 ชม.`,
      },
      {
        at: t - step,
        group: "risk",
        who: "Portfolio Risk AI",
        what: decision ? "ตรวจเพดานความเสี่ยงผ่าน" : "รอข้อมูลเพิ่ม",
      },
      {
        at: t,
        group: "master",
        who: "Master Decision AI",
        what: decision
          ? `สรุป ${decision.action} · ความมั่นใจ ${decision.confidence}%`
          : "ยังไม่มีมติ",
      },
    ];

    if (decision && decision.action !== "WAIT") {
      rows.push({
        at: t + 400,
        group: "exec",
        who: "Smart Execution AI",
        what: `เตรียมส่งคำสั่ง ${decision.action} · ขนาด ${decision.positionSizePct}%`,
      });
    }

    return rows.reverse();
  }, [lastUpdate, regime, decision, context, exchanges, connected, now]);

  return (
    <Panel
      title="ไทม์ไลน์การทำงาน"
      titleEn="AI Timeline"
      right={<Tag tone="up">LIVE</Tag>}
      bodyClassName="p-2.5"
    >
      {entries.length === 0 ? (
        <p className="py-8 text-center text-[11px] text-dim">กำลังบันทึกเหตุการณ์…</p>
      ) : (
        <ol className="space-y-0">
          {entries.map((e, i) => {
            const color = GROUP_BY_KEY.get(e.group)?.color ?? "#6b8497";
            return (
              <li key={`${e.at}-${e.who}`} className="flex gap-2.5">
                <span className="relative flex w-3 shrink-0 flex-col items-center">
                  <span
                    className="mt-[6px] size-[7px] shrink-0 rounded-full"
                    style={{ background: color, boxShadow: `0 0 6px ${color}88` }}
                  />
                  {i < entries.length - 1 && (
                    <span className="w-[1px] flex-1 bg-line-soft" />
                  )}
                </span>
                <span className="min-w-0 flex-1 pb-2">
                  <span className="flex items-baseline gap-1.5">
                    <span className="num text-[9.5px] text-dim">
                      {bkkTime(new Date(e.at))}
                    </span>
                    <span className="truncate text-[10.5px] font-medium" style={{ color }}>
                      {e.who}
                    </span>
                  </span>
                  <span className="block truncate text-[10px] text-muted">{e.what}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
