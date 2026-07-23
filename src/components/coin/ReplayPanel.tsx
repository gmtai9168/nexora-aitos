"use client";

import { useEffect, useRef, useState } from "react";
import { bkkTime } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import type { CoinScore } from "@/lib/scoring";
import { Panel, Tag } from "../Panel";
import { Sparkline } from "../viz";

type Frame = {
  at: number;
  symbol: string;
  price: number;
  score: number;
  action: string;
  confidence: number;
  regime: string;
  whale: number | null;
  oi: number | null;
};

const WINDOWS = [
  { key: "1m", th: "1 นาที", ms: 60_000 },
  { key: "5m", th: "5 นาที", ms: 300_000 },
  { key: "1h", th: "1 ชั่วโมง", ms: 3_600_000 },
  { key: "1d", th: "1 วัน", ms: 86_400_000 },
] as const;

const MAX_FRAMES = 600;

/**
 * AI Replay — records what the system actually believed at each poll, so you
 * can scrub back and see the reasoning that preceded an entry. Frames live in
 * this session only; nothing is fabricated for the period before you opened
 * the page.
 */
export function ReplayPanel({ score }: { score: CoinScore }) {
  const { symbol, quotes, decision, regime, context, lastUpdate } = useMarket();
  const [frames, setFrames] = useState<Frame[]>([]);
  const [windowKey, setWindowKey] = useState<(typeof WINDOWS)[number]["key"]>("5m");
  const [cursor, setCursor] = useState<number | null>(null);
  const lastStamp = useRef(0);

  // One frame per quote poll. The append is deferred to its own task so the
  // recorder never re-renders the tree in the middle of an effect pass.
  useEffect(() => {
    if (!lastUpdate || lastUpdate === lastStamp.current) return;
    const price = quotes.get(symbol)?.price;
    if (price === undefined) return;

    lastStamp.current = lastUpdate;
    const frame: Frame = {
      at: lastUpdate,
      symbol,
      price,
      score: score.total,
      action: decision?.action ?? "—",
      confidence: decision?.confidence ?? 0,
      regime: regime.label,
      whale: context.whaleBuyShare,
      oi: context.oiChangePct,
    };

    const id = setTimeout(
      () => setFrames((prev) => [...prev, frame].slice(-MAX_FRAMES)),
      0,
    );
    return () => clearTimeout(id);
  }, [lastUpdate, symbol, quotes, score.total, decision, regime.label, context]);

  const win = WINDOWS.find((w) => w.key === windowKey)!;
  const now = frames.at(-1)?.at ?? 0;
  const visible = frames.filter((f) => f.symbol === symbol && now - f.at <= win.ms);
  const active = cursor !== null ? visible[Math.min(cursor, visible.length - 1)] : visible.at(-1);

  return (
    <Panel
      title="ย้อนดูความคิดของ AI"
      titleEn="AI Replay"
      right={
        <div className="flex items-center gap-1">
          <Tag tone="up">บันทึก {visible.length} เฟรม</Tag>
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => {
                setWindowKey(w.key);
                setCursor(null);
              }}
              className={`rounded px-1.5 py-[2px] text-[9px] ${
                windowKey === w.key
                  ? "bg-brand text-black"
                  : "text-muted hover:bg-[#0f1c26] hover:text-txt"
              }`}
            >
              {w.th}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      {visible.length < 2 ? (
        <p className="py-8 text-center text-[10.5px] leading-relaxed text-dim">
          กำลังเริ่มบันทึก… ระบบจะเก็บสิ่งที่ AI คิดทุกครั้งที่ราคาอัปเดต
          <br />
          เปิดหน้านี้ทิ้งไว้สักครู่แล้วเลื่อนแถบด้านล่างเพื่อย้อนดูได้
        </p>
      ) : (
        <>
          <Sparkline
            values={visible.map((f) => f.price)}
            height={44}
            stroke={
              (visible.at(-1)?.price ?? 0) >= (visible[0]?.price ?? 0) ? "#14e2a0" : "#ff4a68"
            }
          />

          <input
            type="range"
            min={0}
            max={visible.length - 1}
            value={cursor ?? visible.length - 1}
            onChange={(e) => setCursor(Number(e.target.value))}
            className="w-full accent-[#00d4ff]"
            aria-label="เลื่อนย้อนเวลา"
          />

          {active && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded border border-line-soft bg-[#08111a] px-2.5 py-2 text-[10px]">
              <span className="flex justify-between">
                <span className="text-dim">เวลา</span>
                <span className="num text-txt">{bkkTime(new Date(active.at))}</span>
              </span>
              <span className="flex justify-between">
                <span className="text-dim">ราคา</span>
                <span className="num text-txt">{active.price.toLocaleString()}</span>
              </span>
              <span className="flex justify-between">
                <span className="text-dim">AI Score</span>
                <span className="num text-brand">{active.score}</span>
              </span>
              <span className="flex justify-between">
                <span className="text-dim">มติ</span>
                <span
                  className={
                    active.action === "LONG"
                      ? "text-up"
                      : active.action === "SHORT"
                        ? "text-down"
                        : "text-warn"
                  }
                >
                  {active.action} {active.confidence ? `${active.confidence}%` : ""}
                </span>
              </span>
              <span className="flex justify-between">
                <span className="text-dim">สภาวะตลาด</span>
                <span className="text-muted">{active.regime}</span>
              </span>
              <span className="flex justify-between">
                <span className="text-dim">แรงซื้อรายใหญ่</span>
                <span className="num text-muted">
                  {active.whale === null ? "—" : `${active.whale.toFixed(0)}%`}
                </span>
              </span>
            </div>
          )}

          {cursor !== null && cursor < visible.length - 1 && (
            <button
              type="button"
              onClick={() => setCursor(null)}
              className="rounded border border-line bg-[#0d1922] py-1 text-[10px] text-muted hover:text-txt"
            >
              กลับไปเวลาปัจจุบัน
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
