"use client";

import { bkkShort } from "@/lib/format";
import type { NewsItem } from "@/lib/use-coin-intel";
import { Panel, Tag } from "../Panel";

/** Longer headlines usually mean a fuller story — a crude impact proxy. */
function impact(n: NewsItem): "HIGH" | "MEDIUM" | "LOW" {
  const hot = /\b(SEC|Fed|FOMC|ETF|hack|ban|halving|rate|inflation|approval)\b/i.test(n.title);
  if (hot && n.sentiment !== "กลาง") return "HIGH";
  if (hot || n.sentiment !== "กลาง") return "MEDIUM";
  return "LOW";
}

export function NewsPanel({ items }: { items: NewsItem[] }) {
  const positive = items.filter((n) => n.sentiment === "บวก").length;
  const negative = items.filter((n) => n.sentiment === "ลบ").length;

  return (
    <Panel
      title="ข่าวและเหตุการณ์สำคัญ"
      titleEn="News Intelligence"
      right={
        <div className="flex items-center gap-1">
          <Tag tone="up">บวก {positive}</Tag>
          <Tag tone="down">ลบ {negative}</Tag>
        </div>
      }
      bodyClassName="p-0 flex flex-col"
    >
      <ul className="max-h-[320px] flex-1 divide-y divide-line-soft overflow-y-auto">
        {items.length === 0 && (
          <li className="px-3 py-8 text-center text-[11px] text-dim">กำลังโหลดข่าว…</li>
        )}
        {items.map((n) => {
          const imp = impact(n);
          return (
            <li key={n.id}>
              <a
                href={n.link || undefined}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 px-3 py-[7px] hover:bg-[#0e1a24]"
              >
                <span className="num shrink-0 pt-[1px] text-[9.5px] text-dim">
                  {n.time ? bkkShort(new Date(n.time)) : "--:--"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] text-txt">{n.title}</span>
                  <span className="block truncate text-[8.5px] text-dim">{n.publisher}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span
                    className={`rounded border px-1 py-[1px] text-[8.5px] ${
                      imp === "HIGH"
                        ? "border-down/40 text-down"
                        : imp === "MEDIUM"
                          ? "border-warn/40 text-warn"
                          : "border-line text-dim"
                    }`}
                  >
                    {imp}
                  </span>
                  <Tag
                    tone={
                      n.sentiment === "บวก" ? "up" : n.sentiment === "ลบ" ? "down" : "neutral"
                    }
                  >
                    {n.sentiment}
                  </Tag>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] text-dim">
        ข่าวจาก Yahoo Finance (รวม Reuters, Bloomberg และสำนักข่าวอื่น) ·
        คะแนนอารมณ์และระดับผลกระทบประเมินจากคำสำคัญในหัวข้อ ไม่ใช่คำแนะนำการลงทุน
      </p>
    </Panel>
  );
}
