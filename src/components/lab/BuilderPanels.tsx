"use client";

import { KIND_META, type BacktestResult, type StrategyKind, type StrategyParams } from "@/lib/strategy";
import { Panel, Tag } from "../Panel";

export type SavedStrategy = {
  id: string;
  name: string;
  kind: StrategyKind;
  stage: "production" | "shadow" | "paper" | "testing";
  params: StrategyParams;
};

const STAGE_META = {
  production: { th: "ใช้งานจริง", tone: "up" as const },
  shadow: { th: "Shadow", tone: "warn" as const },
  paper: { th: "Paper", tone: "neutral" as const },
  testing: { th: "กำลังทดสอบ", tone: "neutral" as const },
};

/** Sections 1 + 17 — the strategy library / internal marketplace. */
export function StrategyLibrary({
  items,
  activeId,
  onSelect,
  onClone,
}: {
  items: SavedStrategy[];
  activeId: string;
  onSelect: (id: string) => void;
  onClone: (id: string) => void;
}) {
  return (
    <Panel
      title="คลังกลยุทธ์"
      titleEn="Strategy Library"
      right={<Tag tone="neutral">{items.length} กลยุทธ์</Tag>}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {items.map((s) => {
          const meta = KIND_META[s.kind];
          const stage = STAGE_META[s.stage];
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className={`flex w-full items-center gap-2 px-3 py-[7px] text-left hover:bg-[#0e1a24] ${
                  activeId === s.id ? "bg-[#0e1f26]" : ""
                }`}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: meta.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px]">{s.name}</span>
                  <span className="block truncate text-[9px] text-dim">
                    {meta.th} · {meta.en}
                  </span>
                </span>
                <Tag tone={stage.tone}>{stage.th}</Tag>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClone(s.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      onClone(s.id);
                    }
                  }}
                  className="shrink-0 rounded border border-line px-1.5 py-[1px] text-[9px] text-muted hover:border-brand/40 hover:text-brand"
                >
                  Clone
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** Section 2 — the brief that generates a strategy. */
export function StrategyGenerator({
  params,
  onChange,
  onGenerate,
  symbol,
  interval,
  onInterval,
}: {
  params: StrategyParams;
  onChange: (p: StrategyParams) => void;
  onGenerate: (kind: StrategyKind) => void;
  symbol: string;
  interval: string;
  onInterval: (v: string) => void;
}) {
  return (
    <Panel
      title="ให้ AI สร้างกลยุทธ์"
      titleEn="AI Strategy Generator"
      right={<Tag tone="up">สร้างแล้วทดสอบทันที</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <label className="block">
          <span className="text-dim">ตลาด Market</span>
          <div className="chip mt-[2px] px-2 py-1 text-txt">{symbol}</div>
        </label>
        <label className="block">
          <span className="text-dim">ไทม์เฟรม Timeframe</span>
          <select
            value={interval}
            onChange={(e) => onInterval(e.target.value)}
            className="chip mt-[2px] w-full px-2 py-1 text-txt outline-none"
          >
            {["15m", "1h", "4h", "1d"].map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-dim">ความเสี่ยงต่อไม้ Risk</span>
          <select
            value={params.riskPct}
            onChange={(e) => onChange({ ...params, riskPct: Number(e.target.value) })}
            className="chip mt-[2px] w-full px-2 py-1 text-txt outline-none"
          >
            {[0.25, 0.5, 1, 1.5].map((r) => (
              <option key={r} value={r}>
                {r}% ({r <= 0.5 ? "ต่ำ" : r <= 1 ? "กลาง" : "สูง"})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-dim">ถือนานสุด Holding</span>
          <select
            value={params.maxHoldBars}
            onChange={(e) => onChange({ ...params, maxHoldBars: Number(e.target.value) })}
            className="chip mt-[2px] w-full px-2 py-1 text-txt outline-none"
          >
            {[6, 12, 24, 48, 96].map((b) => (
              <option key={b} value={b}>
                {b} แท่ง
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="mb-1 text-[9.5px] text-dim">เป้าหมายกลยุทธ์ Target</div>
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(KIND_META) as StrategyKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onGenerate(k)}
              className={`rounded border px-2 py-1.5 text-left text-[10px] transition-colors ${
                params.kind === k
                  ? "border-brand/60 bg-[#062a38] text-brand"
                  : "border-line bg-[#0d1922] text-muted hover:text-txt"
              }`}
            >
              <span className="block font-semibold">{KIND_META[k].th}</span>
              <span className="block text-[8.5px] text-dim">{KIND_META[k].en}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-[9px] leading-snug text-dim">
        เลือกเป้าหมายแล้ว AI จะตั้งค่าพารามิเตอร์เริ่มต้นที่เหมาะกับรูปแบบนั้น
        แล้วรัน Backtest กับข้อมูลจริงย้อนหลังทันที
      </p>
    </Panel>
  );
}

/** Section 3 — the logic canvas. */
export function StrategyCanvas({ params }: { params: StrategyParams }) {
  const meta = KIND_META[params.kind];

  const blocks = [
    {
      th: "ข้อมูลตลาด",
      en: "Market Data",
      items: ["ราคา OHLCV", `EMA ${params.emaFast}/${params.emaSlow}`, `RSI ${params.rsiPeriod}`, `ATR ${params.atrPeriod}`],
      color: "#3b9dff",
    },
    {
      th: "สัญญาณเข้า",
      en: "Entry Logic",
      items:
        params.kind === "breakout"
          ? ["ทะลุกรอบสูงสุด/ต่ำสุด", `ย้อนหลัง ${Math.max(10, params.emaSlow)} แท่ง`]
          : params.kind === "meanReversion"
            ? [`RSI < ${100 - params.rsiFilter}`, "ราคาต่ำกว่า EMA ช้า"]
            : [`EMA ตัดขึ้น/ลง`, `กรอง RSI ${params.rsiFilter}`],
      color: meta.color,
    },
    {
      th: "บริหารความเสี่ยง",
      en: "Risk Logic",
      items: [`Stop ${params.stopAtr} ATR`, `เสี่ยง ${params.riskPct}%/ไม้`, `Leverage ${params.leverage}X`],
      color: "#fb7185",
    },
    {
      th: "สัญญาณออก",
      en: "Exit Logic",
      items: [`เป้าหมาย ${params.targetR}R`, `ถือไม่เกิน ${params.maxHoldBars} แท่ง`, "ตัดขาดทุนอัตโนมัติ"],
      color: "#ffb020",
    },
    {
      th: "ส่งคำสั่ง",
      en: "Execution",
      items: ["เข้าที่ราคาเปิดแท่งถัดไป", `ค่าธรรมเนียม ${params.feePct}%/ขา`, "Smart Routing"],
      color: "#5eead4",
    },
  ];

  return (
    <Panel
      title="ผังตรรกะกลยุทธ์"
      titleEn="Strategy Canvas"
      right={<Tag tone="neutral">{meta.en}</Tag>}
      bodyClassName="p-2.5"
    >
      <div className="flex flex-wrap items-stretch gap-1.5">
        {blocks.map((b, i) => (
          <div key={b.en} className="flex min-w-[150px] flex-1 items-center gap-1.5">
            <div
              className="min-w-0 flex-1 rounded border px-2 py-1.5"
              style={{ borderColor: `${b.color}55`, background: "#0a121a" }}
            >
              <div className="truncate text-[10px] font-semibold" style={{ color: b.color }}>
                {b.th}
              </div>
              <div className="truncate text-[8.5px] text-dim">{b.en}</div>
              <ul className="mt-1 space-y-[1px]">
                {b.items.map((it) => (
                  <li key={it} className="truncate text-[9px] text-muted">
                    · {it}
                  </li>
                ))}
              </ul>
            </div>
            {i < blocks.length - 1 && (
              <span className="shrink-0 text-[11px] text-dim">→</span>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Section 4 — the parameter sliders. */
export function ParamsPanel({
  params,
  onChange,
}: {
  params: StrategyParams;
  onChange: (p: StrategyParams) => void;
}) {
  const fields: {
    key: keyof StrategyParams;
    th: string;
    min: number;
    max: number;
    step: number;
    unit?: string;
  }[] = [
    { key: "emaFast", th: "EMA เร็ว", min: 5, max: 40, step: 1 },
    { key: "emaSlow", th: "EMA ช้า", min: 20, max: 120, step: 1 },
    { key: "rsiFilter", th: "กรอง RSI", min: 40, max: 70, step: 1 },
    { key: "stopAtr", th: "Stop (ATR)", min: 0.6, max: 4, step: 0.1, unit: "×" },
    { key: "targetR", th: "เป้าหมาย (R)", min: 0.8, max: 5, step: 0.1, unit: "R" },
    { key: "maxHoldBars", th: "ถือนานสุด", min: 4, max: 120, step: 1, unit: " แท่ง" },
    { key: "riskPct", th: "เสี่ยงต่อไม้", min: 0.1, max: 2, step: 0.05, unit: "%" },
    { key: "leverage", th: "Leverage", min: 1, max: 25, step: 1, unit: "X" },
  ];

  return (
    <Panel
      title="พารามิเตอร์กลยุทธ์"
      titleEn="Strategy Parameters"
      right={
        <button
          type="button"
          onClick={() => onChange({ ...params, allowShort: !params.allowShort })}
          className={`rounded border px-1.5 py-[2px] text-[9.5px] ${
            params.allowShort
              ? "border-up/50 bg-[#0d2b23] text-up"
              : "border-line bg-[#0d1922] text-muted"
          }`}
        >
          Short {params.allowShort ? "เปิด" : "ปิด"}
        </button>
      }
      bodyClassName="p-2.5 flex flex-col gap-1.5"
    >
      {fields.map((f) => (
        <div key={f.key}>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted">{f.th}</span>
            <span className="num text-txt">
              {params[f.key] as number}
              {f.unit ?? ""}
            </span>
          </div>
          <input
            type="range"
            min={f.min}
            max={f.max}
            step={f.step}
            value={params[f.key] as number}
            onChange={(e) => onChange({ ...params, [f.key]: Number(e.target.value) })}
            className="w-full accent-[#00d4ff]"
          />
        </div>
      ))}
    </Panel>
  );
}

/** Section 5 — the strategy's report card, read from its own backtest. */
export function AiRecommendation({
  result,
  params,
  overfit,
}: {
  result: BacktestResult;
  params: StrategyParams;
  overfit: boolean;
}) {
  const strength = Math.max(
    0,
    Math.min(100, result.profitFactor * 26 + result.winRate * 0.4 - result.maxDrawdown * 1.2),
  );

  const suggestions: string[] = [];
  if (result.trades.length < 25)
    suggestions.push("จำนวนไม้น้อยเกินไป — ผ่อนเงื่อนไขเข้าหรือขยายช่วงข้อมูลย้อนหลัง");
  if (result.maxDrawdown > 20)
    suggestions.push(`Drawdown สูงถึง ${result.maxDrawdown.toFixed(1)}% — ลดความเสี่ยงต่อไม้หรือขยาย Stop`);
  if (result.winRate < 40 && result.profitFactor < 1.3)
    suggestions.push("อัตราชนะต่ำและ Profit Factor ยังไม่คุ้ม — พิจารณาเพิ่มตัวกรองสัญญาณ");
  if (result.profitFactor > 1 && result.avgLoss > result.avgWin)
    suggestions.push("ขาดทุนเฉลี่ยมากกว่ากำไรเฉลี่ย — เพิ่มเป้าหมาย R หรือใช้ Trailing Stop");
  if (params.targetR < 1.5)
    suggestions.push("เป้าหมายต่ำกว่า 1.5R ทำให้ต้องพึ่งอัตราชนะสูงมาก");
  if (overfit) suggestions.push("ผลนอกกลุ่มตัวอย่างตกแรง — ลดจำนวนพารามิเตอร์ที่จูน");
  if (result.tradesPerMonth > 60)
    suggestions.push("ความถี่สูงมาก ต้นทุนค่าธรรมเนียมจะกินกำไร — ตรวจสอบสมมติฐานค่าธรรมเนียม");
  if (suggestions.length === 0)
    suggestions.push("โครงสร้างกลยุทธ์สมดุลดี — ขั้นถัดไปคือ Paper Trading");

  const suitable =
    params.kind === "trend" || params.kind === "breakout"
      ? "ตลาดที่มีแนวโน้มชัดเจน"
      : params.kind === "meanReversion"
        ? "ตลาดที่แกว่งในกรอบ"
        : "ตลาดที่มีสภาพคล่องสูง";
  const avoid =
    params.kind === "trend" || params.kind === "breakout"
      ? "ตลาดออกข้าง (Sideway)"
      : "ตลาดที่วิ่งทางเดียวแรงๆ";

  return (
    <Panel
      title="AI ประเมินกลยุทธ์"
      titleEn="AI Recommendation"
      right={
        <Tag tone={strength >= 65 ? "up" : strength >= 45 ? "warn" : "down"}>
          ความแข็งแรง {strength.toFixed(0)}%
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <span className="flex justify-between">
          <span className="text-dim">เหมาะกับ</span>
          <span className="text-up">{suitable}</span>
        </span>
        <span className="flex justify-between">
          <span className="text-dim">ควรเลี่ยง</span>
          <span className="text-down">{avoid}</span>
        </span>
        <span className="flex justify-between">
          <span className="text-dim">จุดอ่อน</span>
          <span className="text-warn">
            {result.maxDrawdown > 15
              ? "Drawdown สูง"
              : result.tradesPerMonth > 40
                ? "ไวต่อค่าธรรมเนียม"
                : "อ่อนไหวต่อความผันผวน"}
          </span>
        </span>
        <span className="flex justify-between">
          <span className="text-dim">ข้อเสนอปรับปรุง</span>
          <span className="num text-brand">{suggestions.length} ข้อ</span>
        </span>
      </div>

      <ul className="space-y-1 rounded border border-line-soft bg-[#08111a] p-2">
        {suggestions.map((s, i) => (
          <li key={s} className="text-[9.5px] leading-snug text-muted">
            <span className="mr-1 text-brand">{i + 1}.</span>
            {s}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
