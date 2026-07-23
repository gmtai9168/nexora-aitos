"use client";

import { fmtNum, fmtPct } from "@/lib/format";
import type {
  CurveStat,
  Improvement,
  MonthCell,
  PeriodRow,
  RiskAnalytics,
  StrategyRow,
  TradeAnalytics,
  TwinResult,
} from "@/lib/performance";
import { Panel, Tag } from "../Panel";
import { Donut, RingGauge } from "../viz";

const col = (v: number) => (v >= 0 ? "#14e2a0" : "#ff4a68");

export function KpiStrip({
  cards,
}: {
  cards: { th: string; en: string; value: string; tone?: string; sub?: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {cards.map((c) => (
        <div key={c.th} className="panel min-w-0 flex-1 px-2.5 py-1.5">
          <div className="truncate text-[9px] tracking-wide text-dim">
            {c.th} <span className="text-[8px]">{c.en}</span>
          </div>
          <div className={`num truncate text-[15px] font-bold ${c.tone ?? "text-txt"}`}>
            {c.value}
          </div>
          {c.sub && <div className="truncate text-[8.5px] text-dim">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Section 4 — portfolio vs benchmark vs buy & hold on one axis. */
export function EquityCurvePanel({
  portfolio,
  benchmark,
  stat,
  benchStat,
}: {
  portfolio: number[];
  benchmark: number[];
  stat: CurveStat;
  benchStat: CurveStat;
}) {
  const path = (series: number[], lo: number, span: number) =>
    series
      .map((v, i) => {
        const x = (i / Math.max(series.length - 1, 1)) * 100;
        const y = 100 - ((v - lo) / span) * 92 - 4;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");

  const all = [...portfolio, ...benchmark];
  const lo = all.length ? Math.min(...all) : 0;
  const hi = all.length ? Math.max(...all) : 1;
  const span = hi - lo || 1;

  return (
    <Panel
      title="เส้นการเติบโตเทียบเกณฑ์มาตรฐาน"
      titleEn="Equity Curve Analysis"
      right={
        <div className="flex items-center gap-2 text-[9px]">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-up" /> พอร์ต AI
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[#a78bfa]" /> ถือยาว (Buy &amp; Hold)
          </span>
        </div>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      {portfolio.length < 3 ? (
        <p className="py-12 text-center text-[11px] text-dim">กำลังคำนวณผลย้อนหลัง…</p>
      ) : (
        <>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[210px] w-full">
            <defs>
              <linearGradient id="pf-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={col(stat.returnPct)} stopOpacity="0.24" />
                <stop offset="100%" stopColor={col(stat.returnPct)} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              points={`0,100 ${path(portfolio, lo, span)} 100,100`}
              fill="url(#pf-fill)"
            />
            <polyline
              points={path(benchmark, lo, span)}
              fill="none"
              stroke="#a78bfa"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={path(portfolio, lo, span)}
              fill="none"
              stroke={col(stat.returnPct)}
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="grid grid-cols-3 gap-1.5">
            {[
              { th: "พอร์ต AI", v: stat.returnPct, c: col(stat.returnPct) },
              { th: "ถือยาว Buy & Hold", v: benchStat.returnPct, c: "#a78bfa" },
              {
                th: "ส่วนต่าง Alpha",
                v: stat.returnPct - benchStat.returnPct,
                c: col(stat.returnPct - benchStat.returnPct),
              },
            ].map((r) => (
              <div key={r.th} className="rounded border border-line-soft bg-[#0a121a] px-2 py-1">
                <div className="truncate text-[9px] text-dim">{r.th}</div>
                <div className="num text-[14px] font-bold" style={{ color: r.c }}>
                  {fmtPct(r.v)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

/** Section 5 — where the return actually came from. */
export function AttributionPanel({ rows }: { rows: StrategyRow[] }) {
  const total = rows.reduce((a, r) => a + Math.abs(r.contributionPct), 0) || 1;
  const net = rows.reduce((a, r) => a + r.contributionPct, 0);

  return (
    <Panel
      title="ที่มาของผลตอบแทน"
      titleEn="Profit Attribution"
      right={
        <Tag tone={net >= 0 ? "up" : "down"}>รวม {fmtPct(net)}</Tag>
      }
      bodyClassName="p-2.5 flex items-center gap-3"
    >
      <Donut
        slices={rows.map((r) => ({
          label: r.name,
          value: Math.abs(r.contributionPct),
          color: r.color,
        }))}
        size={124}
        thickness={17}
      />
      <ul className="min-w-0 flex-1 space-y-[3px]">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-1.5 text-[10px]">
            <span className="size-2 shrink-0 rounded-full" style={{ background: r.color }} />
            <span className="min-w-0 flex-1 truncate text-muted">{r.name}</span>
            <span className="num shrink-0 text-dim">
              {((Math.abs(r.contributionPct) / total) * 100).toFixed(0)}%
            </span>
            <span
              className="num w-[54px] shrink-0 text-right font-semibold"
              style={{ color: col(r.contributionPct) }}
            >
              {fmtPct(r.contributionPct)}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Sections 2 + 3 — the AI/strategy leaderboard. */
export function StrategyTable({ rows }: { rows: StrategyRow[] }) {
  const ranked = [...rows].sort((a, b) => b.result.returnPct - a.result.returnPct);

  return (
    <Panel
      title="อันดับผลงาน AI และกลยุทธ์"
      titleEn="AI & Strategy Performance"
      right={<Tag tone="neutral">{rows.length} กลยุทธ์</Tag>}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-dim">
              <th className="px-3 py-1.5 font-medium">#</th>
              <th className="px-2 py-1.5 font-medium">กลยุทธ์ / AI</th>
              <th className="px-2 py-1.5 text-right font-medium">ผลตอบแทน</th>
              <th className="px-2 py-1.5 text-right font-medium">Win Rate</th>
              <th className="px-2 py-1.5 text-right font-medium">PF</th>
              <th className="px-2 py-1.5 text-right font-medium">Sharpe</th>
              <th className="px-2 py-1.5 text-right font-medium">Max DD</th>
              <th className="px-2 py-1.5 text-right font-medium">น้ำหนัก</th>
              <th className="px-3 py-1.5 font-medium">เกรด</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr key={r.id} className="border-t border-line-soft text-[10.5px]">
                <td className="num px-3 py-[6px] text-dim">{i + 1}</td>
                <td className="px-2 py-[6px]">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: r.color }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-[8.5px] text-dim">
                        {r.aiName} · {r.kindTh}
                      </span>
                    </span>
                  </span>
                </td>
                <td
                  className="num px-2 py-[6px] text-right font-semibold"
                  style={{ color: col(r.result.returnPct) }}
                >
                  {fmtPct(r.result.returnPct)}
                </td>
                <td className="num px-2 py-[6px] text-right">
                  {r.result.winRate.toFixed(1)}%
                </td>
                <td className="num px-2 py-[6px] text-right text-brand">
                  {r.result.profitFactor.toFixed(2)}
                </td>
                <td className="num px-2 py-[6px] text-right text-muted">
                  {r.result.sharpe.toFixed(2)}
                </td>
                <td className="num px-2 py-[6px] text-right text-down/80">
                  {r.result.maxDrawdown.toFixed(1)}%
                </td>
                <td className="num px-2 py-[6px] text-right text-dim">
                  {(r.weight * 100).toFixed(0)}%
                </td>
                <td className="px-3 py-[6px]">
                  <Tag
                    tone={
                      r.grade === "ดีเยี่ยม"
                        ? "up"
                        : r.grade === "ดี"
                          ? "up"
                          : r.grade === "พอใช้"
                            ? "warn"
                            : "down"
                    }
                  >
                    {r.grade}
                  </Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] text-dim">
        ทุกแถวรัน Backtest บนแท่งเทียนชุดเดียวกันและช่วงเวลาเดียวกัน จึงเปรียบเทียบกันได้ตรงไปตรงมา
      </p>
    </Panel>
  );
}

/** Risk-return scatter — each strategy plotted by volatility against return. */
export function ScatterPanel({
  rows,
  benchStat,
}: {
  rows: StrategyRow[];
  benchStat: CurveStat;
}) {
  const pts = rows.map((r) => ({
    label: r.name,
    color: r.color,
    x: r.result.maxDrawdown,
    y: r.result.returnPct,
  }));
  const all = [...pts, { label: "Buy & Hold", color: "#a78bfa", x: benchStat.maxDrawdown, y: benchStat.returnPct }];

  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const xMax = Math.max(...xs, 1) * 1.15;
  const yMin = Math.min(...ys, 0) * 1.2 - 1;
  const yMax = Math.max(...ys, 1) * 1.2 + 1;

  return (
    <Panel
      title="ผลตอบแทนเทียบความเสี่ยง"
      titleEn="Risk-Return Scatter"
      right={<Tag tone="neutral">แกน X = Max Drawdown</Tag>}
      bodyClassName="p-2.5"
    >
      <svg viewBox="0 0 100 68" className="h-[200px] w-full">
        <line x1="10" y1="4" x2="10" y2="60" stroke="#16242f" strokeWidth="0.4" />
        <line x1="10" y1="60" x2="98" y2="60" stroke="#16242f" strokeWidth="0.4" />
        {/* Zero-return reference line */}
        {yMin < 0 && yMax > 0 && (
          <line
            x1="10"
            y1={60 - ((0 - yMin) / (yMax - yMin)) * 56}
            x2="98"
            y2={60 - ((0 - yMin) / (yMax - yMin)) * 56}
            stroke="#233542"
            strokeWidth="0.4"
            strokeDasharray="1 1.5"
          />
        )}
        {all.map((p) => {
          const cx = 10 + (p.x / xMax) * 88;
          const cy = 60 - ((p.y - yMin) / (yMax - yMin)) * 56;
          return (
            <g key={p.label}>
              <circle cx={cx} cy={cy} r="2" fill={p.color} opacity="0.9" />
              <text
                x={cx + 3}
                y={cy + 1}
                fill="#6b8497"
                fontSize="2.6"
              >
                {p.label}
              </text>
            </g>
          );
        })}
        <text x="54" y="66" textAnchor="middle" fill="#47616f" fontSize="2.8">
          ความเสี่ยง (Max Drawdown %)
        </text>
      </svg>
      <p className="text-[9px] text-dim">
        จุดที่อยู่ซ้ายบนคือดีที่สุด — ผลตอบแทนสูงที่ความเสี่ยงต่ำ ·
        จุดม่วงคือการถือยาวเฉยๆ ใช้เป็นเส้นเปรียบเทียบ
      </p>
    </Panel>
  );
}

/** Sections 6 — trade analytics with the hour-of-day heatmap. */
export function TradePanel({ data }: { data: TradeAnalytics }) {
  const maxTrades = Math.max(...data.byHour.map((h) => h.trades), 1);

  const rows: [string, string][] = [
    ["จำนวนไม้ทั้งหมด", `${data.total}`],
    ["ถือเฉลี่ย", `${data.avgHoldingBars.toFixed(1)} แท่ง`],
    ["กำไรเฉลี่ยต่อไม้ชนะ", fmtPct(data.avgWin)],
    ["ขาดทุนเฉลี่ยต่อไม้แพ้", fmtPct(data.avgLoss)],
    ["ไม้ที่ดีที่สุด", fmtPct(data.bestTrade)],
    ["ไม้ที่แย่ที่สุด", fmtPct(data.worstTrade)],
    ["ถือนานสุด", `${data.longestBars} แท่ง`],
    ["ถือสั้นสุด", `${data.shortestBars} แท่ง`],
  ];

  return (
    <Panel
      title="วิเคราะห์การเทรด"
      titleEn="Trade Analytics"
      right={<Tag tone="neutral">{data.total} ไม้</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-x-3">
        {rows.map(([k, v]) => (
          <span
            key={k}
            className="flex justify-between border-b border-line-soft py-[3.5px] text-[10px]"
          >
            <span className="truncate text-dim">{k}</span>
            <span className="num truncate pl-1 text-txt">{v}</span>
          </span>
        ))}
      </div>

      <div>
        <div className="mb-1 text-[9.5px] text-dim">
          ผลเฉลี่ยต่อไม้แยกตามชั่วโมงที่เข้า (UTC) · ความสูง = จำนวนไม้
        </div>
        <div className="flex h-[54px] items-end gap-[2px]">
          {data.byHour.map((h) => (
            <span
              key={h.hour}
              title={`${String(h.hour).padStart(2, "0")}:00 · ${h.trades} ไม้ · ${h.avgR.toFixed(2)}R`}
              className="flex-1 rounded-t"
              style={{
                height: `${Math.max(2, (h.trades / maxTrades) * 48)}px`,
                background: h.trades === 0 ? "#16242f" : col(h.avgR),
                opacity: h.trades === 0 ? 0.5 : 0.85,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[8px] text-dim">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>23</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line-soft pt-2 text-[9.5px]">
        {data.bySide.map((s) => (
          <span key={s.side} className="flex justify-between">
            <span className="text-dim">ฝั่ง {s.side}</span>
            <span className="num text-muted">
              {s.trades} ไม้ · ชนะ {s.winRate.toFixed(0)}%
            </span>
          </span>
        ))}
        {data.byReason.map((r) => (
          <span key={r.reason} className="flex justify-between">
            <span className="text-dim">ปิดเพราะ{r.th}</span>
            <span className="num text-muted">{r.count} ไม้</span>
          </span>
        ))}
      </div>
    </Panel>
  );
}

/** Section 7 — risk analytics. */
export function RiskPanel({ data, stat }: { data: RiskAnalytics; stat: CurveStat }) {
  const rows: [string, string, string?][] = [
    ["ความเสี่ยงเฉลี่ยต่อไม้", `${data.avgRiskPct.toFixed(2)}%`],
    ["ความเสี่ยงสูงสุดต่อไม้", `${data.maxRiskPct.toFixed(2)}%`],
    ["เลเวอเรจที่ตั้งไว้", `${data.leverage}X`],
    ["ถูกบังคับปิด", `${data.liquidations} ครั้ง`, "text-up"],
    ["แพ้ติดกันมากสุด", `${data.worstStreak} ไม้`, data.worstStreak > 6 ? "text-down" : undefined],
    ["ชนะติดกันมากสุด", `${data.bestStreak} ไม้`, "text-up"],
    [
      "สัดส่วนเวลาที่ถือสถานะ",
      `${data.totalBars ? ((data.exposureBars / data.totalBars) * 100).toFixed(1) : "0"}%`,
    ],
    ["ความผันผวนของพอร์ต", `${stat.volatility.toFixed(2)}%`],
    ["Max Drawdown", `${stat.maxDrawdown.toFixed(2)}%`, stat.maxDrawdown > 15 ? "text-down" : "text-up"],
    ["Calmar Ratio", stat.calmar.toFixed(2), stat.calmar >= 1 ? "text-up" : undefined],
  ];

  return (
    <Panel
      title="วิเคราะห์ความเสี่ยง"
      titleEn="Risk Analytics"
      right={<Tag tone={stat.maxDrawdown > 15 ? "down" : "up"}>DD {stat.maxDrawdown.toFixed(1)}%</Tag>}
      bodyClassName="p-2.5"
    >
      {rows.map(([k, v, tone]) => (
        <div
          key={k}
          className="flex items-center justify-between border-b border-line-soft py-[4.5px] text-[10.5px] last:border-0"
        >
          <span className="text-muted">{k}</span>
          <span className={`num font-semibold ${tone ?? "text-txt"}`}>{v}</span>
        </div>
      ))}
      <p className="mt-1.5 text-[9px] leading-snug text-dim">
        เครื่องยนต์ทดสอบเคารพ Stop เสมอ จำนวนการถูกบังคับปิดจึงเป็นศูนย์ตามนิยาม —
        ในระบบจริงตัวเลขนี้ต้องมาจากบันทึกของ exchange
      </p>
    </Panel>
  );
}

/** Section 11 + timeframe table. */
export function PeriodPanel({
  periods,
  benchmarks,
}: {
  periods: PeriodRow[];
  benchmarks: { label: string; returnPct: number; color: string }[];
}) {
  const max = Math.max(...benchmarks.map((b) => Math.abs(b.returnPct)), 1);

  return (
    <Panel
      title="ผลตอบแทนตามช่วงเวลาและเทียบเกณฑ์"
      titleEn="Timeframe & Benchmark"
      bodyClassName="p-2.5 grid gap-3 md:grid-cols-2"
    >
      <div>
        <div className="mb-1 text-[9.5px] text-dim">ผลตอบแทนย้อนหลัง</div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-dim">
              <th className="py-1 font-medium">ช่วง</th>
              <th className="py-1 text-right font-medium">ผลตอบแทน</th>
              <th className="py-1 text-right font-medium">เหนือเกณฑ์</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.label} className="border-t border-line-soft text-[10.5px]">
                <td className="py-[5px] text-muted">{p.label}</td>
                <td
                  className="num py-[5px] text-right font-semibold"
                  style={{ color: col(p.returnPct) }}
                >
                  {fmtPct(p.returnPct)}
                </td>
                <td
                  className="num py-[5px] text-right"
                  style={{ color: col(p.vsBenchmark) }}
                >
                  {fmtPct(p.vsBenchmark)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="mb-1 text-[9.5px] text-dim">เทียบกับเกณฑ์มาตรฐาน</div>
        <ul className="space-y-1.5">
          {benchmarks.map((b) => (
            <li key={b.label}>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted">{b.label}</span>
                <span className="num font-semibold" style={{ color: col(b.returnPct) }}>
                  {fmtPct(b.returnPct)}
                </span>
              </div>
              <div className="mt-[2px] h-[5px] overflow-hidden rounded-full bg-[#16242f]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(Math.abs(b.returnPct) / max) * 100}%`,
                    background: b.color,
                    marginLeft: b.returnPct < 0 ? "auto" : undefined,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/** Monthly calendar returns. */
export function MonthlyPanel({ cells }: { cells: MonthCell[] }) {
  const max = Math.max(...cells.map((c) => Math.abs(c.returnPct)), 0.5);

  return (
    <Panel
      title="ผลตอบแทนรายเดือน"
      titleEn="Monthly Performance"
      right={<Tag tone="neutral">{cells.length} เดือน</Tag>}
      bodyClassName="p-2.5"
    >
      {cells.length === 0 ? (
        <p className="py-8 text-center text-[11px] text-dim">ยังไม่มีไม้ที่ปิดแล้ว</p>
      ) : (
        <>
          <div className="flex h-[120px] items-center gap-1">
            {cells.map((c) => {
              const h = (Math.abs(c.returnPct) / max) * 52;
              return (
                <span key={c.label} className="flex flex-1 flex-col items-center justify-center">
                  <span className="flex h-[52px] w-full items-end justify-center">
                    {c.returnPct >= 0 && (
                      <span
                        className="w-full rounded-t"
                        style={{ height: `${h}px`, background: "#14e2a0", opacity: 0.85 }}
                      />
                    )}
                  </span>
                  <span className="h-[1px] w-full bg-line" />
                  <span className="flex h-[52px] w-full items-start justify-center">
                    {c.returnPct < 0 && (
                      <span
                        className="w-full rounded-b"
                        style={{ height: `${h}px`, background: "#ff4a68", opacity: 0.85 }}
                      />
                    )}
                  </span>
                </span>
              );
            })}
          </div>
          <div className="mt-1 flex gap-1">
            {cells.map((c) => (
              <span
                key={c.label}
                className="num flex-1 truncate text-center text-[8px] text-dim"
              >
                {c.label}
              </span>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

/** Section 9 + 10 — the executive view and the written summary. */
export function ExecutivePanel({
  score,
  summary,
  kpis,
}: {
  score: number;
  summary: string;
  kpis: { th: string; value: string; tone?: string }[];
}) {
  return (
    <Panel
      title="สรุปสำหรับผู้บริหาร"
      titleEn="Executive Dashboard"
      right={
        <Tag tone={score >= 70 ? "up" : score >= 50 ? "warn" : "down"}>
          คะแนน {score}/100
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2 sm:flex-row"
    >
      <div className="flex shrink-0 flex-col items-center justify-center">
        <RingGauge
          value={score}
          size={120}
          label={`${score}`}
          sub="Performance Score"
          color={score >= 70 ? "#14e2a0" : score >= 50 ? "#ffb020" : "#ff4a68"}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="grid grid-cols-2 gap-x-3">
          {kpis.map((k) => (
            <span
              key={k.th}
              className="flex justify-between border-b border-line-soft py-[3.5px] text-[10px]"
            >
              <span className="truncate text-dim">{k.th}</span>
              <span className={`num truncate pl-1 font-semibold ${k.tone ?? "text-txt"}`}>
                {k.value}
              </span>
            </span>
          ))}
        </div>
        <div className="mt-2 rounded border border-brand/30 bg-[#062028] px-2.5 py-2">
          <div className="mb-0.5 text-[9.5px] text-brand">AI Executive Summary</div>
          <p className="text-[10.5px] leading-relaxed text-muted">{summary}</p>
        </div>
      </div>
    </Panel>
  );
}

/** The Performance Digital Twin. */
export function TwinPanel({ rows }: { rows: TwinResult[] }) {
  return (
    <Panel
      title="ฝาแฝดดิจิทัลของผลงาน"
      titleEn="Performance Digital Twin"
      right={<Tag tone="up">จำลองโดยไม่กระทบของจริง</Tag>}
      bodyClassName="p-0"
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[9px] uppercase tracking-wide text-dim">
            <th className="px-3 py-1.5 font-medium">สมมติฐานที่จำลอง</th>
            <th className="px-2 py-1.5 text-right font-medium">ผลตอบแทน</th>
            <th className="px-2 py-1.5 text-right font-medium">Δ ผลตอบแทน</th>
            <th className="px-2 py-1.5 text-right font-medium">Δ Drawdown</th>
            <th className="px-3 py-1.5 font-medium">สรุป</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line-soft text-[10.5px]">
              <td className="px-3 py-[6px] text-muted">{r.th}</td>
              <td className="num px-2 py-[6px] text-right" style={{ color: col(r.returnPct) }}>
                {fmtPct(r.returnPct)}
              </td>
              <td className="num px-2 py-[6px] text-right" style={{ color: col(r.deltaReturn) }}>
                {fmtPct(r.deltaReturn)}
              </td>
              <td
                className="num px-2 py-[6px] text-right"
                style={{ color: col(-r.deltaDrawdown) }}
              >
                {fmtPct(r.deltaDrawdown)}
              </td>
              <td className="px-3 py-[6px]">
                <Tag
                  tone={r.verdict === "ดีขึ้น" ? "up" : r.verdict === "แย่ลง" ? "down" : "neutral"}
                >
                  {r.verdict}
                </Tag>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        แต่ละแถวคือการรัน Backtest ใหม่ทั้งชุดภายใต้สมมติฐานที่เปลี่ยนไป —
        ไม่ใช่การประมาณค่า และไม่กระทบพอร์ตจริง
      </p>
    </Panel>
  );
}

/** Sections 14 + 15 — export and the improvement backlog. */
export function ImprovementPanel({
  items,
  onExport,
}: {
  items: Improvement[];
  onExport: (kind: string) => void;
}) {
  return (
    <Panel
      title="สิ่งที่ควรปรับปรุงต่อ"
      titleEn="Continuous Improvement & Export"
      right={
        <div className="flex gap-1">
          {["CSV", "JSON"].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onExport(k)}
              className="rounded border border-line px-1.5 py-[2px] text-[9px] text-muted hover:border-brand/40 hover:text-brand"
            >
              ส่งออก {k}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {items.map((i) => (
          <li key={i.id} className="px-3 py-[7px]">
            <div className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded border px-1.5 py-[1px] text-[8.5px] ${
                  i.priority === "สูง"
                    ? "border-down/40 text-down"
                    : i.priority === "กลาง"
                      ? "border-warn/40 text-warn"
                      : "border-line text-dim"
                }`}
              >
                {i.priority}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10.5px] text-txt">{i.th}</span>
            </div>
            <p className="mt-0.5 text-[9.5px] leading-snug text-muted">{i.reason}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export { fmtNum };
