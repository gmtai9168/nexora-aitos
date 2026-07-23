"use client";

import {
  GROUP_BY_KEY,
  STATUS_META,
  telemetry,
  trustScore,
  type Agent,
  type AgentStatus,
} from "@/lib/agents";
import { fmtPct } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import { Panel, Tag } from "../Panel";

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded border border-line-soft bg-[#0a121a] px-2 py-1">
      <div className="truncate text-[9px] text-dim">{label}</div>
      <div className={`num truncate text-[12.5px] font-bold ${tone ?? "text-txt"}`}>
        {value}
      </div>
    </div>
  );
}

function Meter({ label, value, unit = "%" }: { label: string; value: number; unit?: string }) {
  const pct = Math.min(100, value);
  return (
    <div>
      <div className="flex justify-between text-[9.5px]">
        <span className="text-dim">{label}</span>
        <span className="num text-muted">
          {value.toFixed(0)}
          {unit}
        </span>
      </div>
      <div className="mt-[2px] h-[3px] overflow-hidden rounded-full bg-[#16242f]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: pct > 80 ? "#ff4a68" : pct > 55 ? "#ffb020" : "#14e2a0",
          }}
        />
      </div>
    </div>
  );
}

const ACTIONS = [
  { key: "pause", th: "หยุดชั่วคราว", en: "Pause" },
  { key: "restart", th: "รีสตาร์ต", en: "Restart" },
  { key: "clone", th: "โคลน", en: "Clone" },
  { key: "train", th: "ฝึกโมเดล", en: "Training" },
  { key: "setting", th: "ตั้งค่า", en: "Setting" },
  { key: "history", th: "ประวัติ", en: "History" },
] as const;

export function AgentDetails({
  agent,
  status,
  paused,
  onTogglePause,
}: {
  agent: Agent | null;
  status: AgentStatus;
  paused: boolean;
  onTogglePause: () => void;
}) {
  const { quotes } = useMarket();

  if (!agent) {
    return (
      <Panel title="รายละเอียด AI" titleEn="AI Details" bodyClassName="p-3">
        <p className="py-10 text-center text-[11px] text-dim">
          คลิกที่ AI ตัวใดก็ได้บนแผนผังเพื่อดูรายละเอียด
        </p>
      </Panel>
    );
  }

  const group = GROUP_BY_KEY.get(agent.group)!;
  const move = agent.symbol ? (quotes.get(agent.symbol)?.changePct ?? null) : null;
  const t = telemetry(agent, move);
  const trust = trustScore(t);
  const meta = STATUS_META[status];

  return (
    <Panel
      title="รายละเอียด AI"
      titleEn="AI Details"
      right={<Tag tone="warn">TELEMETRY จำลอง</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2.5"
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border-2"
          style={{ borderColor: meta.color, background: "#08131b" }}
        >
          <span className="size-2.5 rounded-full" style={{ background: meta.color }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-txt">{agent.name}</div>
          <div className="truncate text-[10px] text-dim">
            {agent.nameTh} · {group.en}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className="rounded border px-1.5 py-[1px] text-[9.5px] font-semibold"
              style={{ borderColor: `${meta.color}66`, color: meta.color }}
            >
              {meta.th}
            </span>
            <span className="num text-[9.5px] text-dim">v{t.version}</span>
            {agent.symbol && (
              <span className="text-[9.5px] text-muted">{agent.symbol}</span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[9px] text-dim">Trust Score</div>
          <div
            className={`num text-[22px] font-extrabold leading-none ${
              trust.score >= 78 ? "text-up" : trust.score >= 60 ? "text-warn" : "text-down"
            }`}
          >
            {trust.score}
          </div>
          <div className="text-[9px] text-brand">เกรด {trust.grade}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Field label="Accuracy" value={`${t.accuracy.toFixed(1)}%`} />
        <Field label="Win Rate" value={`${t.winRate.toFixed(0)}%`} />
        <Field
          label="ถือเฉลี่ย Holding"
          value={t.avgHoldingMin >= 60 ? `${(t.avgHoldingMin / 60).toFixed(1)} ชม.` : `${t.avgHoldingMin} น.`}
        />
        <Field label="Decisions วันนี้" value={`${t.decisionsToday}`} />
        <Field label="Trades วันนี้" value={`${t.tradesToday}`} />
        <Field
          label="Profit วันนี้"
          value={fmtPct(t.profitPct)}
          tone={t.profitPct >= 0 ? "text-up" : "text-down"}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded border border-line-soft bg-[#08111a] px-2.5 py-2">
        <Meter label="CPU" value={t.cpu} />
        <Meter label="GPU" value={t.gpu} />
        <Meter label="RAM" value={(t.ram / 2048) * 100} unit="" />
        <Meter label="Latency" value={(t.latency / 60) * 100} unit="" />
        <div className="col-span-2 flex justify-between text-[9px] text-dim">
          <span>
            RAM <span className="num text-muted">{t.ram} MB</span>
          </span>
          <span>
            Latency <span className="num text-muted">{t.latency} ms</span>
          </span>
          <span>
            ฝึกล่าสุด <span className="num text-muted">{t.lastTrainedDays} วัน</span>
          </span>
        </div>
      </div>

      <div>
        <div className="mb-1 text-[9.5px] text-dim">องค์ประกอบ Trust Score</div>
        <ul className="space-y-[3px]">
          {trust.parts.map((p) => (
            <li key={p.key} className="flex items-center gap-2">
              <span className="w-[104px] shrink-0 truncate text-[9.5px] text-muted">
                {p.th}
              </span>
              <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#16242f]">
                <span
                  className="block h-full rounded-full bg-brand"
                  style={{ width: `${Math.min(100, p.value)}%` }}
                />
              </span>
              <span className="num w-7 shrink-0 text-right text-[9px] text-dim">
                {p.value.toFixed(0)}
              </span>
              <span className="num w-8 shrink-0 text-right text-[9px] text-brand/70">
                ×{p.weight.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[9.5px] text-dim">Exchange:</span>
        {t.exchanges.length ? (
          t.exchanges.map((e) => (
            <span
              key={e}
              className="rounded border border-line px-1.5 py-[1px] text-[9.5px] text-muted"
            >
              {e}
            </span>
          ))
        ) : (
          <span className="text-[9.5px] text-dim">ไม่ผูกกับ exchange</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {ACTIONS.map((a) => {
          const isPause = a.key === "pause";
          return (
            <button
              key={a.key}
              type="button"
              onClick={isPause ? onTogglePause : undefined}
              className={`rounded border py-1.5 text-[10px] transition-colors ${
                isPause && paused
                  ? "border-up/50 bg-[#0d2b23] text-up"
                  : "border-line bg-[#0d1922] text-muted hover:border-brand/40 hover:text-brand"
              }`}
            >
              {isPause && paused ? "เปิดใช้งาน Resume" : `${a.th} ${a.en}`}
            </button>
          );
        })}
      </div>

      <p className="text-[9px] leading-snug text-dim">
        ตัวเลข Accuracy / CPU / RAM / เวอร์ชัน เป็นค่าจำลองที่ผูกกับรหัสของ AI แต่ละตัว
        (คงที่ ไม่สุ่มใหม่ทุกครั้ง) ส่วน Profit วันนี้ของ AI ที่ผูกกับคู่เทรด
        ใช้การเคลื่อนไหว 24 ชม. จริงของคู่นั้น
      </p>
    </Panel>
  );
}
