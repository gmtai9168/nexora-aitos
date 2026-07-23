"use client";

import type { MacroRow } from "@/app/api/macro/route";
import { bkkShort, fmtCompact, fmtNum, fmtPct } from "@/lib/format";
import {
  STANCE_TH,
  type AssetClassRead,
  type CurrencyStrength,
  type GlobalRecommendation,
  type NewsImpact,
  type RadarSignal,
  type RegionPulse,
  type Scenario,
} from "@/lib/global-intel";
import { Panel, Tag } from "../Panel";

const stanceTone = (s: string) =>
  s === "Bullish" ? "up" : s === "Bearish" ? "down" : "neutral";

const pctColor = (v: number | null) =>
  v === null ? "#47616f" : v > 0 ? "#14e2a0" : v < 0 ? "#ff4a68" : "#6b8497";

/** Section 1 — the one-glance read on every asset class. */
export function WorldStatusPanel({
  classes,
  fearGreed,
  vix,
}: {
  classes: AssetClassRead[];
  fearGreed: number | null;
  vix: number | null;
}) {
  const riskOn =
    classes.filter((c) => c.stance === "Bullish").length >
    classes.filter((c) => c.stance === "Bearish").length;

  return (
    <Panel
      title="สถานะตลาดโลก"
      titleEn="World Market Status"
      right={
        <Tag tone={riskOn ? "up" : "down"}>
          AI Market Regime: {riskOn ? "RISK ON" : "RISK OFF"}
        </Tag>
      }
      bodyClassName="p-2.5 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4"
    >
      {classes.map((c) => (
        <div key={c.key} className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
          <div className="flex items-baseline justify-between">
            <span className="truncate text-[10px] text-muted">
              {c.th} <span className="text-[8.5px] text-dim">{c.en}</span>
            </span>
            <span
              className="num text-[11px] font-bold"
              style={{ color: pctColor(c.changePct) }}
            >
              {fmtPct(c.changePct)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between">
            <Tag tone={stanceTone(c.stance)}>{STANCE_TH[c.stance]}</Tag>
            <span className="truncate text-[8.5px] text-dim">{c.detail}</span>
          </div>
        </div>
      ))}

      <div className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5 sm:col-span-2 xl:col-span-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
          <span className="text-dim">
            Fear &amp; Greed{" "}
            <span
              className="num font-bold"
              style={{
                color:
                  fearGreed === null ? "#47616f" : fearGreed >= 55 ? "#14e2a0" : fearGreed <= 40 ? "#ff4a68" : "#ffb020",
              }}
            >
              {fearGreed ?? "—"}
            </span>
          </span>
          <span className="text-dim">
            VIX{" "}
            <span
              className="num font-bold"
              style={{ color: vix === null ? "#47616f" : vix > 25 ? "#ff4a68" : "#14e2a0" }}
            >
              {vix?.toFixed(2) ?? "—"}
            </span>
          </span>
          <span className="ml-auto text-[9px] text-dim">
            ประเมินจากดัชนีจริงของแต่ละสินทรัพย์ ไม่ใช่ค่าที่ตั้งไว้ล่วงหน้า
          </span>
        </div>
      </div>
    </Panel>
  );
}

/** Section 2 — the live world map. */
export function WorldMapPanel({ regions }: { regions: RegionPulse[] }) {
  // Rough screen positions on a 100×52 grid, good enough to read as a map.
  const POS: Record<string, { x: number; y: number }> = {
    us: { x: 17, y: 20 },
    uk: { x: 41, y: 10 },
    eu: { x: 53, y: 20 },
    jp: { x: 89, y: 15 },
    hk: { x: 82, y: 28 },
    th: { x: 68, y: 38 },
  };

  return (
    <Panel
      title="แผนที่ตลาดโลก"
      titleEn="World Market Live Map"
      right={
        <Tag tone={regions.some((r) => r.hot) ? "warn" : "up"}>
          {regions.some((r) => r.hot) ? "มีภูมิภาคเคลื่อนไหวแรง" : "ทุกภูมิภาคปกติ"}
        </Tag>
      }
      bodyClassName="p-2.5"
    >
      <div className="relative h-[210px] w-full overflow-hidden rounded border border-line-soft bg-[#060d14]">
        <svg viewBox="0 0 100 52" className="absolute inset-0 size-full" aria-hidden="true">
          {/* Dot-grid landmass suggestion */}
          {Array.from({ length: 26 }).map((_, r) =>
            Array.from({ length: 50 }).map((__, c) => {
              const x = c * 2 + 1;
              const y = r * 2 + 1;
              const land =
                (x > 8 && x < 30 && y > 8 && y < 34) ||
                (x > 24 && x < 34 && y > 30 && y < 46) ||
                (x > 42 && x < 56 && y > 8 && y < 24) ||
                (x > 44 && x < 58 && y > 24 && y < 40) ||
                (x > 58 && x < 90 && y > 10 && y < 34) ||
                (x > 78 && x < 92 && y > 34 && y < 46);
              if (!land) return null;
              return (
                <circle key={`${r}-${c}`} cx={x} cy={y} r="0.42" fill="#16303f" />
              );
            }),
          )}
        </svg>

        {regions.map((r) => {
          const p = POS[r.key];
          const color = pctColor(r.changePct);
          return (
            <div
              key={r.key}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${p.x}%`, top: `${(p.y / 52) * 100}%` }}
            >
              <div
                className="rounded border px-1.5 py-[3px] text-center"
                style={{
                  borderColor: `${color}66`,
                  background: "rgba(6,13,20,0.9)",
                  boxShadow: r.hot ? `0 0 12px ${color}66` : undefined,
                }}
              >
                <div className="whitespace-nowrap text-[8.5px] text-muted">{r.th}</div>
                <div className="num whitespace-nowrap text-[11px] font-bold" style={{ color }}>
                  {r.changePct === null ? "—" : fmtPct(r.changePct)}
                </div>
              </div>
              {r.hot && (
                <span
                  className="dot-live absolute -right-1 -top-1 size-1.5 rounded-full"
                  style={{ background: color }}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[9px] text-dim">
        แต่ละภูมิภาคใช้ดัชนีหุ้นจริงของตัวเอง (S&amp;P/NASDAQ/DOW · DAX · FTSE · Nikkei ·
        Hang Seng · SET) — จุดกระพริบคือภูมิภาคที่เคลื่อนไหวเกิน 1.2%
      </p>
    </Panel>
  );
}

/** Major indices table. */
export function IndicesPanel({ rows }: { rows: MacroRow[] }) {
  const groups: { key: string; th: string }[] = [
    { key: "index", th: "ดัชนีหุ้น" },
    { key: "rate", th: "ผลตอบแทนพันธบัตร" },
    { key: "fx", th: "ค่าเงิน" },
    { key: "commodity", th: "สินค้าโภคภัณฑ์" },
  ];

  return (
    <Panel
      title="ดัชนีและสินทรัพย์หลัก"
      titleEn="Major Indices & Macro"
      right={<Tag tone="up">Yahoo Finance</Tag>}
      bodyClassName="p-0"
    >
      <div className="max-h-[420px] overflow-y-auto">
        {groups.map((g) => {
          const items = rows.filter((r) => r.group === g.key);
          if (items.length === 0) return null;
          return (
            <div key={g.key}>
              <div className="sticky top-0 border-y border-line-soft bg-panel px-3 py-1 text-[9px] uppercase tracking-wide text-dim">
                {g.th}
              </div>
              <ul>
                {items.map((r) => (
                  <li
                    key={r.symbol}
                    className="flex items-center gap-2 px-3 py-[5px] text-[10.5px]"
                  >
                    <span className="w-[74px] shrink-0 truncate font-medium">{r.label}</span>
                    <span className="min-w-0 flex-1 truncate text-[9px] text-dim">{r.th}</span>
                    <span className="num w-[74px] shrink-0 text-right">
                      {fmtNum(r.price, r.price > 1000 ? 0 : r.price > 10 ? 2 : 4)}
                    </span>
                    <span
                      className="num w-[58px] shrink-0 text-right font-semibold"
                      style={{ color: pctColor(r.changePct) }}
                    >
                      {fmtPct(r.changePct)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/** Sections 3 + 4 — headlines with the impact analysis attached. */
export function NewsImpactPanel({ items }: { items: NewsImpact[] }) {
  return (
    <Panel
      title="ข่าวด่วนและการวิเคราะห์ผลกระทบ"
      titleEn="Breaking News & AI Impact"
      right={
        <Tag tone={items.some((i) => i.impact === "HIGH") ? "down" : "neutral"}>
          ผลกระทบสูง {items.filter((i) => i.impact === "HIGH").length}
        </Tag>
      }
      bodyClassName="p-0"
    >
      {items.length === 0 ? (
        <p className="px-3 py-8 text-center text-[11px] text-dim">กำลังโหลดข่าว…</p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-line-soft overflow-y-auto">
          {items.map((n) => (
            <li key={n.item.id} className="px-3 py-2">
              <a
                href={n.item.link || undefined}
                target="_blank"
                rel="noreferrer"
                className="block hover:underline"
              >
                <div className="flex items-start gap-2">
                  <span className="num shrink-0 pt-[1px] text-[9px] text-dim">
                    {n.item.time ? bkkShort(new Date(n.item.time)) : "--:--"}
                  </span>
                  <span className="min-w-0 flex-1 text-[10.5px] leading-snug text-txt">
                    {n.item.title}
                  </span>
                  <span
                    className={`shrink-0 rounded border px-1 py-[1px] text-[8.5px] ${
                      n.impact === "HIGH"
                        ? "border-down/40 text-down"
                        : n.impact === "MEDIUM"
                          ? "border-warn/40 text-warn"
                          : "border-line text-dim"
                    }`}
                  >
                    {n.impact}
                  </span>
                </div>
              </a>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px]">
                <span className="text-dim">
                  ทิศทาง{" "}
                  <span
                    className={
                      n.direction === "Bullish"
                        ? "text-up"
                        : n.direction === "Bearish"
                          ? "text-down"
                          : "text-muted"
                    }
                  >
                    {STANCE_TH[n.direction]}
                  </span>
                </span>
                <span className="text-dim">
                  ความมั่นใจ <span className="num text-brand">{n.confidence}%</span>
                </span>
                <span className="text-dim">
                  ผลกระทบนาน <span className="text-muted">{n.durationTh}</span>
                </span>
                <span className="flex flex-wrap gap-1">
                  {n.affected.map((a) => (
                    <span
                      key={a}
                      className="rounded bg-[#16242f] px-1 py-[1px] text-[8.5px] text-muted"
                    >
                      {a}
                    </span>
                  ))}
                </span>
              </div>
              <p className="mt-0.5 text-[9px] leading-snug text-dim">{n.reasonTh}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        การจัดระดับผลกระทบใช้คำสำคัญในหัวข้อข่าว แล้ว
        <span className="text-muted">ตรวจสอบกับการเคลื่อนไหวจริงของตลาด</span> —
        ถ้าข่าวสวนทางกับราคา ระบบจะลดความมั่นใจลงเอง
      </p>
    </Panel>
  );
}

/** Section 6 — the macro board. */
export function MacroPanel({ rows }: { rows: MacroRow[] }) {
  const get = (s: string) => rows.find((r) => r.symbol === s);
  const tnx = get("^TNX");
  const fvx = get("^FVX");
  const tyx = get("^TYX");
  const dxy = get("DX-Y.NYB");
  const vix = get("^VIX");

  // An inverted curve (10Y below 5Y) is the classic recession flag.
  const spread = tnx && fvx ? tnx.price - fvx.price : null;

  const cards: { th: string; en: string; value: string; sub: string; tone?: string }[] = [
    {
      th: "ผลตอบแทน 10 ปี",
      en: "US 10Y",
      value: tnx ? `${tnx.price.toFixed(3)}%` : "—",
      sub: tnx ? fmtPct(tnx.changePct) : "",
      tone: (tnx?.changePct ?? 0) > 0 ? "text-down" : "text-up",
    },
    {
      th: "ส่วนต่าง 10Y-5Y",
      en: "Curve",
      value: spread === null ? "—" : `${spread.toFixed(3)}%`,
      sub: spread === null ? "" : spread < 0 ? "เส้นผลตอบแทนกลับด้าน" : "ปกติ",
      tone: spread !== null && spread < 0 ? "text-down" : "text-up",
    },
    {
      th: "ผลตอบแทน 30 ปี",
      en: "US 30Y",
      value: tyx ? `${tyx.price.toFixed(3)}%` : "—",
      sub: tyx ? fmtPct(tyx.changePct) : "",
    },
    {
      th: "ดัชนีดอลลาร์",
      en: "DXY",
      value: dxy ? dxy.price.toFixed(2) : "—",
      sub: dxy ? fmtPct(dxy.changePct) : "",
      tone: (dxy?.changePct ?? 0) > 0 ? "text-down" : "text-up",
    },
    {
      th: "ความผันผวนหุ้น",
      en: "VIX",
      value: vix ? vix.price.toFixed(2) : "—",
      sub: vix ? (vix.price > 25 ? "ความกลัวสูง" : vix.price < 15 ? "ตลาดสงบ" : "ปกติ") : "",
      tone: (vix?.price ?? 0) > 25 ? "text-down" : "text-up",
    },
    {
      th: "สภาพคล่องเชิงเปรียบเทียบ",
      en: "Liquidity Proxy",
      value:
        dxy && tnx ? `${(100 - (dxy.price - 90) - tnx.price * 3).toFixed(1)}` : "—",
      sub: "ดอลลาร์อ่อน + ดอกเบี้ยต่ำ = สภาพคล่องดี",
    },
  ];

  return (
    <Panel
      title="ภาพเศรษฐกิจมหภาค"
      titleEn="Macro Dashboard"
      right={<Tag tone="up">เรียลไทม์</Tag>}
      bodyClassName="p-2.5 grid gap-1.5 sm:grid-cols-3"
    >
      {cards.map((c) => (
        <div key={c.en} className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
          <div className="truncate text-[9px] text-dim">
            {c.th} <span className="text-[8px]">{c.en}</span>
          </div>
          <div className={`num truncate text-[14px] font-bold ${c.tone ?? "text-txt"}`}>
            {c.value}
          </div>
          <div className="truncate text-[8.5px] text-dim">{c.sub}</div>
        </div>
      ))}
    </Panel>
  );
}

/** Sections 7 + 8 — ETF proxy flow and stablecoin pegs. */
export function FlowPanel({
  etfRows,
  stablecoins,
}: {
  etfRows: MacroRow[];
  stablecoins: { symbol: string; price: number; changePct: number; volume: number }[];
}) {
  const etfAvg = etfRows.length
    ? etfRows.reduce((a, r) => a + r.changePct, 0) / etfRows.length
    : 0;
  const worstPeg = stablecoins.length
    ? Math.max(...stablecoins.map((s) => Math.abs(s.price - 1)))
    : 0;

  return (
    <Panel
      title="กระแสเงิน ETF และ Stablecoin"
      titleEn="ETF & Stablecoin Flow"
      right={
        <Tag tone={etfAvg >= 0 ? "up" : "down"}>
          ETF {etfAvg >= 0 ? "แรงซื้อ" : "แรงขาย"}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div>
        <div className="mb-1 text-[9.5px] text-dim">
          กองทุน ETF คริปโต · ใช้ราคาซื้อขายจริงเป็นตัวแทนกระแสเงินสถาบัน
        </div>
        <ul className="space-y-[3px]">
          {etfRows.map((r) => (
            <li key={r.symbol} className="flex items-center gap-2 text-[10.5px]">
              <span className="w-[52px] shrink-0 font-medium">{r.label}</span>
              <span className="min-w-0 flex-1 truncate text-[9px] text-dim">{r.th}</span>
              <span className="num w-[62px] shrink-0 text-right text-muted">
                ${r.price.toFixed(2)}
              </span>
              <span
                className="num w-[58px] shrink-0 text-right font-semibold"
                style={{ color: pctColor(r.changePct) }}
              >
                {fmtPct(r.changePct)}
              </span>
            </li>
          ))}
          {etfRows.length === 0 && (
            <li className="py-3 text-center text-[10px] text-dim">ไม่มีข้อมูล ETF</li>
          )}
        </ul>
      </div>

      <div className="border-t border-line-soft pt-2">
        <div className="mb-1 flex items-center justify-between text-[9.5px]">
          <span className="text-dim">Stablecoin · ตรวจการตรึงค่ากับดอลลาร์</span>
          <span className={worstPeg > 0.005 ? "text-down" : "text-up"}>
            เบี่ยงสูงสุด {(worstPeg * 100).toFixed(3)}%
          </span>
        </div>
        <ul className="space-y-[3px]">
          {stablecoins.map((s) => {
            const dev = (s.price - 1) * 100;
            return (
              <li key={s.symbol} className="flex items-center gap-2 text-[10.5px]">
                <span className="w-[52px] shrink-0 font-medium">{s.symbol}</span>
                <span className="num w-[66px] shrink-0 text-right text-muted">
                  {s.price.toFixed(4)}
                </span>
                <span className="h-[4px] flex-1 overflow-hidden rounded-full bg-[#16242f]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.abs(dev) * 200)}%`,
                      background: Math.abs(dev) > 0.5 ? "#ff4a68" : "#14e2a0",
                    }}
                  />
                </span>
                <span className="num w-[64px] shrink-0 text-right text-dim">
                  {fmtCompact(s.volume)}
                </span>
              </li>
            );
          })}
          {stablecoins.length === 0 && (
            <li className="py-3 text-center text-[10px] text-dim">ไม่มีข้อมูล</li>
          )}
        </ul>
      </div>

      <p className="text-[9px] leading-snug text-dim">
        ไม่มี public API ที่ให้ตัวเลข net inflow/outflow ของ ETF โดยตรง ระบบจึงใช้
        ราคาและการเคลื่อนไหวจริงของกองทุนเป็นตัวแทน — ระบุไว้ตรงนี้เพื่อไม่ให้เข้าใจผิด
      </p>
    </Panel>
  );
}

/** Currency strength ladder. */
export function CurrencyPanel({ rows }: { rows: CurrencyStrength[] }) {
  return (
    <Panel
      title="ความแข็งแกร่งของค่าเงิน"
      titleEn="Currency Strength"
      right={<Tag tone="neutral">24 ชม.</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-1.5"
    >
      {rows.map((c) => (
        <div key={c.code} className="flex items-center gap-2">
          <span className="w-[34px] shrink-0 text-[10.5px] font-semibold">{c.code}</span>
          <span className="w-[62px] shrink-0 truncate text-[9px] text-dim">{c.th}</span>
          <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#16242f]">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${c.score}%`,
                background: c.score >= 55 ? "#14e2a0" : c.score <= 45 ? "#ff4a68" : "#ffb020",
              }}
            />
          </span>
          <span className="num w-6 shrink-0 text-right text-[10px] font-bold">
            {c.score.toFixed(0)}
          </span>
        </div>
      ))}
    </Panel>
  );
}

/** The Global Event Radar. */
export function RadarPanel({ signals }: { signals: RadarSignal[] }) {
  const LEVEL_TONE: Record<string, "up" | "warn" | "down" | "neutral"> = {
    "Early Watch": "neutral",
    Developing: "warn",
    Confirmed: "down",
    "Market Reaction": "down",
  };

  return (
    <Panel
      title="เรดาร์เหตุการณ์ล่วงหน้า"
      titleEn="Global Event Radar AI"
      right={
        <Tag tone={signals.some((s) => s.score >= 60) ? "down" : "up"}>
          ยืนยันแล้ว {signals.filter((s) => s.score >= 60).length}
        </Tag>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {signals.map((s) => (
          <li key={s.key} className="flex items-center gap-2 px-3 py-[6px]">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{
                background:
                  s.score >= 80 ? "#ff4a68" : s.score >= 60 ? "#ff8f3d" : s.score >= 35 ? "#ffb020" : "#33505f",
              }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px]">{s.th}</span>
              <span className="block truncate text-[9px] text-dim">{s.detail}</span>
            </span>
            <span className="h-[3px] w-[42px] shrink-0 overflow-hidden rounded-full bg-[#16242f]">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${s.score}%`,
                  background: s.score >= 60 ? "#ff4a68" : s.score >= 35 ? "#ffb020" : "#14e2a0",
                }}
              />
            </span>
            <Tag tone={LEVEL_TONE[s.level]}>{s.levelTh}</Tag>
          </li>
        ))}
      </ul>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        เรดาร์ไม่รอให้ข่าวออก แต่เฝ้าสัญญาณล่วงหน้า — ผลตอบแทนพันธบัตร ดัชนีดอลลาร์
        การตรึงค่า stablecoin สัญญาคงค้าง กระแส ETF และความผันผวน
        แล้วจัดระดับตามความคืบหน้าจริง ผลลัพธ์เป็นความน่าจะเป็น ไม่ใช่การรับประกัน
      </p>
    </Panel>
  );
}

/** Sections 12 + 14 — the stance board and the three forward scenarios. */
export function OutlookPanel({
  recs,
  scenarios,
}: {
  recs: GlobalRecommendation[];
  scenarios: Scenario[];
}) {
  const top = [...scenarios].sort((a, b) => b.probability - a.probability)[0];

  return (
    <Panel
      title="สรุปมุมมองและฉากทัศน์"
      titleEn="AI Recommendation & Scenarios"
      right={<Tag tone="neutral">น่าจะเป็นที่สุด: {top?.th}</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <ul className="space-y-[3px]">
        {recs.map((r) => (
          <li key={r.asset} className="flex items-center gap-2">
            <span className="w-[54px] shrink-0 text-[10.5px] font-semibold">{r.asset}</span>
            <Tag tone={stanceTone(r.stance)}>{STANCE_TH[r.stance]}</Tag>
            <span className="min-w-0 flex-1 truncate text-[9px] text-dim">{r.reasonTh}</span>
          </li>
        ))}
      </ul>

      <div className="border-t border-line-soft pt-2">
        <div className="mb-1 text-[9.5px] text-dim">ฉากทัศน์ 3 แบบ · รวมกันได้ 100%</div>
        <div className="mb-1.5 flex h-3.5 overflow-hidden rounded">
          {scenarios.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-center text-[8.5px] font-bold text-black"
              style={{
                width: `${s.probability}%`,
                background:
                  s.key === "bull" ? "#14e2a0" : s.key === "bear" ? "#ff4a68" : "#33505f",
              }}
            >
              {s.probability > 12 ? `${s.probability.toFixed(0)}%` : ""}
            </div>
          ))}
        </div>
        <ul className="space-y-1.5">
          {scenarios.map((s) => (
            <li key={s.key} className="rounded border border-line-soft bg-[#08111a] px-2 py-1.5">
              <div className="flex items-baseline justify-between">
                <span
                  className={`text-[10.5px] font-semibold ${
                    s.key === "bull" ? "text-up" : s.key === "bear" ? "text-down" : "text-muted"
                  }`}
                >
                  {s.th}
                </span>
                <span className="num text-[11px] font-bold text-brand">
                  {s.probability.toFixed(0)}%
                </span>
              </div>
              <p className="text-[9px] leading-snug text-dim">
                <span className="text-muted">เงื่อนไข:</span> {s.conditionTh}
              </p>
              <p className="text-[9px] leading-snug text-dim">
                <span className="text-muted">แนวทาง:</span> {s.actionTh}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
