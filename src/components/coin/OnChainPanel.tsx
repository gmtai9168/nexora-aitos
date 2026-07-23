"use client";

import { fmtCompact, fmtNum } from "@/lib/format";
import type { OnChain } from "@/lib/scoring";
import { Panel, Tag } from "../Panel";
import { Sparkline } from "../viz";

function Row({
  th,
  en,
  value,
  tone,
  verdict,
}: {
  th: string;
  en: string;
  value: string;
  tone?: string;
  verdict?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line-soft py-[5px] last:border-0">
      <span className="min-w-0">
        <span className="block truncate text-[10.5px] text-muted">{th}</span>
        <span className="block truncate text-[8.5px] text-dim">{en}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className={`num text-[11px] font-semibold ${tone ?? "text-txt"}`}>{value}</span>
        {verdict && (
          <span
            className={`rounded border px-1 py-[1px] text-[8.5px] ${
              verdict === "Bullish"
                ? "border-up/40 text-up"
                : verdict === "Bearish"
                  ? "border-down/40 text-down"
                  : "border-line text-dim"
            }`}
          >
            {verdict}
          </span>
        )}
      </span>
    </div>
  );
}

export function OnChainPanel({ data }: { data: OnChain }) {
  const hashEh = data.hashRate !== null ? data.hashRate / 1e18 : null;

  return (
    <Panel
      title="ข้อมูลออนเชนและอารมณ์ตลาด"
      titleEn="On-Chain Intelligence"
      right={
        <Tag tone={data.hasChainData ? "up" : "neutral"}>
          {data.hasChainData ? "BTC CHAIN LIVE" : "ตลาดรวม"}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      {data.fearGreed !== null && (
        <div className="flex items-center gap-3 rounded border border-line-soft bg-[#0a121a] px-2.5 py-2">
          <div className="shrink-0 text-center">
            <div
              className={`num text-[26px] font-extrabold leading-none ${
                data.fearGreed >= 55 ? "text-up" : data.fearGreed <= 40 ? "text-down" : "text-warn"
              }`}
            >
              {data.fearGreed}
            </div>
            <div className="text-[9px] text-dim">{data.fearGreedLabel}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex justify-between text-[9px] text-dim">
              <span>Fear &amp; Greed · 8 วันล่าสุด</span>
              {data.fearGreedPrev !== null && (
                <span className={data.fearGreed >= data.fearGreedPrev ? "text-up" : "text-down"}>
                  {data.fearGreed >= data.fearGreedPrev ? "+" : ""}
                  {data.fearGreed - data.fearGreedPrev} จากเมื่อวาน
                </span>
              )}
            </div>
            <Sparkline
              values={data.fearGreedSeries}
              height={34}
              stroke={data.fearGreed >= 50 ? "#14e2a0" : "#ff4a68"}
            />
          </div>
        </div>
      )}

      {data.hasChainData ? (
        <div>
          <Row
            th="Hash Rate"
            en="พลังขุดรวม"
            value={hashEh === null ? "—" : `${fmtNum(hashEh, 1)} EH/s`}
            verdict={
              data.hashTrendPct === null
                ? undefined
                : data.hashTrendPct > 1
                  ? "Bullish"
                  : data.hashTrendPct < -1
                    ? "Bearish"
                    : "Neutral"
            }
          />
          <Row
            th="แนวโน้มพลังขุด 30 วัน"
            en="Hash Ribbon"
            value={
              data.hashTrendPct === null
                ? "—"
                : `${data.hashTrendPct >= 0 ? "+" : ""}${data.hashTrendPct.toFixed(2)}%`
            }
            tone={(data.hashTrendPct ?? 0) >= 0 ? "text-up" : "text-down"}
          />
          <Row
            th="ธุรกรรม 24 ชม."
            en="Transactions"
            value={data.txCount24h === null ? "—" : fmtCompact(data.txCount24h)}
          />
          <Row
            th="บล็อกที่ขุดได้ 24 ชม."
            en="Blocks Mined"
            value={data.blocksMined24h === null ? "—" : `${data.blocksMined24h}`}
            verdict={
              data.minutesBetweenBlocks === null
                ? undefined
                : data.minutesBetweenBlocks < 10
                  ? "Bullish"
                  : "Neutral"
            }
          />
          <Row
            th="เวลาเฉลี่ยต่อบล็อก"
            en="Block Time"
            value={
              data.minutesBetweenBlocks === null
                ? "—"
                : `${data.minutesBetweenBlocks.toFixed(2)} นาที`
            }
          />
          <Row
            th="มูลค่าโอนบนเชน 24 ชม."
            en="On-chain Volume"
            value={
              data.onChainVolumeUsd === null ? "—" : `$${fmtCompact(data.onChainVolumeUsd)}`
            }
          />
          <Row
            th="ปริมาณซื้อขายบน Exchange"
            en="Exchange Volume"
            value={
              data.exchangeVolumeUsd === null ? "—" : `$${fmtCompact(data.exchangeVolumeUsd)}`
            }
            verdict={
              data.onChainVolumeUsd && data.exchangeVolumeUsd
                ? data.onChainVolumeUsd > data.exchangeVolumeUsd
                  ? "Bullish"
                  : "Neutral"
                : undefined
            }
          />
          <Row
            th="อุปทานหมุนเวียน"
            en="Circulating Supply"
            value={
              data.circulatingSupply === null
                ? "—"
                : `${fmtNum(data.circulatingSupply / 1e6, 2)} M BTC`
            }
          />
        </div>
      ) : (
        <p className="rounded border border-line-soft bg-[#08111a] px-2.5 py-3 text-[10px] leading-relaxed text-dim">
          ข้อมูลออนเชนแบบละเอียด (พลังขุด ธุรกรรม อุปทาน) มีให้เฉพาะ Bitcoin
          ผ่าน blockchain.info และ mempool.space ซึ่งเป็น API สาธารณะที่ไม่ต้องใช้คีย์
          สินทรัพย์อื่นจะแสดงเฉพาะดัชนีอารมณ์ตลาดรวม —
          ระบบเลือกที่จะไม่แสดงตัวเลขที่วัดไม่ได้จริง
        </p>
      )}
    </Panel>
  );
}
