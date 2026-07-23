"use client";

import { fmtCompact, fmtPct } from "@/lib/format";
import type {
  DatasetInfo,
  Drift,
  Feature,
  LearnedRule,
  ModelVersion,
  ResearchTask,
  RewardEvent,
} from "@/lib/learning";
import { Panel, Tag } from "../Panel";

const tone = (v: number) => (v >= 67 ? "#14e2a0" : v >= 34 ? "#ffb020" : "#ff4a68");

/** Section 15 — the lifecycle every model walks. */
const STAGES = [
  { th: "ข้อมูลดิบ", en: "Raw Data", color: "#3b9dff" },
  { th: "ชุดข้อมูล", en: "Dataset", color: "#38bdf8" },
  { th: "ฝึกโมเดล", en: "Training", color: "#a78bfa" },
  { th: "ตรวจสอบ", en: "Validation", color: "#f472b6" },
  { th: "Paper Trading", en: "Paper", color: "#facc15" },
  { th: "Shadow Mode", en: "Shadow", color: "#ffb020" },
  { th: "ใช้งานจริง", en: "Production", color: "#14e2a0" },
  { th: "เฝ้าติดตาม", en: "Monitoring", color: "#5eead4" },
  { th: "ฝึกใหม่", en: "Retraining", color: "#fb7185" },
];

export function LearningPipeline({
  progress,
  needsRetrain,
}: {
  progress: number;
  needsRetrain: boolean;
}) {
  // The cursor sits at Retraining when drift has actually been detected.
  const active = needsRetrain ? STAGES.length - 1 : Math.floor((progress / 100) * (STAGES.length - 1));

  return (
    <Panel
      title="วงจรชีวิตของโมเดล AI"
      titleEn="AI Evolution Roadmap"
      right={
        <Tag tone={needsRetrain ? "warn" : "up"}>
          {needsRetrain ? "ถึงรอบฝึกใหม่" : "เดินหน้าปกติ"}
        </Tag>
      }
      bodyClassName="p-2.5"
    >
      <ol className="flex flex-wrap items-stretch gap-1">
        {STAGES.map((s, i) => {
          const done = i <= active;
          const hot = i === active;
          return (
            <li key={s.en} className="flex min-w-0 flex-1 items-center gap-1">
              <span
                className="flex min-w-0 flex-1 flex-col rounded border px-1.5 py-1.5"
                style={{
                  borderColor: done ? `${s.color}66` : "#16242f",
                  background: hot ? `${s.color}18` : "#0a121a",
                  boxShadow: hot ? `0 0 10px ${s.color}44` : undefined,
                }}
              >
                <span
                  className="truncate text-[9.5px] font-semibold"
                  style={{ color: done ? s.color : "#47616f" }}
                >
                  {s.th}
                </span>
                <span className="truncate text-[8px] text-dim">{s.en}</span>
              </span>
              {i < STAGES.length - 1 && (
                <span
                  className="h-[1px] w-2 shrink-0"
                  style={{ background: done ? `${s.color}88` : "#16242f" }}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-2">
        <div className="flex justify-between text-[9.5px] text-dim">
          <span>ความคืบหน้าการเรียนรู้โดยรวม</span>
          <span className="num text-txt">{progress.toFixed(0)}%</span>
        </div>
        <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-[#16242f]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#00d4ff]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Panel>
  );
}

/** Sections 2 + 8 + 12 — the model library, versions and comparison in one. */
export function ModelLibrary({
  versions,
  onSelect,
  activeVersion,
}: {
  versions: ModelVersion[];
  onSelect: (v: ModelVersion) => void;
  activeVersion: string;
}) {
  const STAGE = {
    production: { th: "ใช้งานจริง", tone: "up" as const },
    shadow: { th: "Shadow", tone: "warn" as const },
    paper: { th: "Paper", tone: "neutral" as const },
    archived: { th: "เก็บไว้", tone: "neutral" as const },
  };

  return (
    <Panel
      title="คลังโมเดลและเวอร์ชัน"
      titleEn="Model Library & Version Control"
      right={<Tag tone="neutral">{versions.length} เวอร์ชัน</Tag>}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-dim">
              <th className="px-3 py-1.5 font-medium">เวอร์ชัน</th>
              <th className="px-2 py-1.5 text-right font-medium">Accuracy</th>
              <th className="px-2 py-1.5 text-right font-medium">ผลตอบแทน</th>
              <th className="px-2 py-1.5 text-right font-medium">PF</th>
              <th className="px-2 py-1.5 text-right font-medium">Max DD</th>
              <th className="px-2 py-1.5 text-right font-medium">ไม้</th>
              <th className="px-3 py-1.5 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr
                key={v.version}
                onClick={() => onSelect(v)}
                className={`cursor-pointer border-t border-line-soft text-[10.5px] hover:bg-[#0e1a24] ${
                  activeVersion === v.version ? "bg-[#0e1f26]" : ""
                }`}
              >
                <td className="px-3 py-[6px]">
                  <span className="block font-semibold">{v.version}</span>
                  <span className="block truncate text-[8.5px] text-dim">{v.label}</span>
                </td>
                <td className="num px-2 py-[6px] text-right">{v.accuracy.toFixed(1)}%</td>
                <td
                  className={`num px-2 py-[6px] text-right ${
                    v.result.returnPct >= 0 ? "text-up" : "text-down"
                  }`}
                >
                  {fmtPct(v.result.returnPct)}
                </td>
                <td className="num px-2 py-[6px] text-right font-bold text-brand">
                  {v.result.profitFactor.toFixed(2)}
                </td>
                <td className="num px-2 py-[6px] text-right text-muted">
                  {v.result.maxDrawdown.toFixed(1)}%
                </td>
                <td className="num px-2 py-[6px] text-right text-dim">
                  {v.result.trades.length}
                </td>
                <td className="px-3 py-[6px]">
                  <Tag tone={STAGE[v.stage].tone}>{STAGE[v.stage].th}</Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        ทุกเวอร์ชันคือชุดพารามิเตอร์จริงที่รัน Backtest บนแท่งเทียนชุดเดียวกัน —
        ตัวที่ Profit Factor สูงสุดจะถูกจัดเป็น Production ส่วนอันดับสองอยู่ใน Shadow
      </p>
    </Panel>
  );
}

/** Section 4 — the real data inventory. */
export function DatasetPanel({ items }: { items: DatasetInfo[] }) {
  const online = items.filter((d) => d.online).length;

  return (
    <Panel
      title="ชุดข้อมูลที่ระบบใช้จริง"
      titleEn="Dataset Manager"
      right={
        <Tag tone={online === items.length ? "up" : "warn"}>
          ออนไลน์ {online}/{items.length}
        </Tag>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {items.map((d) => (
          <li key={d.key} className="flex items-center gap-2 px-3 py-[6px]">
            <span
              className={`size-1.5 shrink-0 rounded-full ${d.online ? "bg-up" : "bg-down"}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px]">{d.th}</span>
              <span className="block truncate text-[8.5px] text-dim">{d.source}</span>
            </span>
            <span className="num w-[58px] shrink-0 text-right text-[10px] text-muted">
              {d.records === null ? "—" : fmtCompact(d.records)}
            </span>
            <span className="num w-[46px] shrink-0 text-right text-[9px] text-dim">
              {d.freshnessSec === null ? "—" : `${d.freshnessSec}s`}
            </span>
            <span className="h-[3px] w-[42px] shrink-0 overflow-hidden rounded-full bg-[#16242f]">
              <span
                className="block h-full rounded-full"
                style={{ width: `${d.quality}%`, background: tone(d.quality) }}
              />
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] text-dim">
        คอลัมน์: จำนวนเรกคอร์ด · อายุข้อมูลล่าสุด · คะแนนคุณภาพ —
        ทั้งหมดวัดจากฟีดที่แอปนี้เรียกใช้จริง ไม่ใช่รายการสมมติ
      </p>
    </Panel>
  );
}

/** Sections 6 + 7 — measured feature weights, stated as an explanation. */
export function ExplainabilityPanel({
  features,
  horizon,
}: {
  features: Feature[];
  horizon: number;
}) {
  const top = features[0];
  const bottom = features.at(-1);

  return (
    <Panel
      title="AI อธิบายการเรียนรู้"
      titleEn="Explainable AI"
      right={<Tag tone="up">วัดจากข้อมูลจริง</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      {features.length === 0 ? (
        <p className="py-8 text-center text-[11px] text-dim">
          ต้องมีแท่งเทียนอย่างน้อย 120 แท่งจึงจะวัดน้ำหนักฟีเจอร์ได้
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {features.map((f) => (
              <li key={f.key}>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted">
                    {f.th} <span className="text-[8.5px] text-dim">{f.en}</span>
                  </span>
                  <span className="num text-txt">
                    น้ำหนัก {f.weight.toFixed(1)}%
                    <span
                      className={`ml-1.5 ${f.correlation >= 0 ? "text-up" : "text-down"}`}
                    >
                      r {f.correlation.toFixed(3)}
                    </span>
                  </span>
                </div>
                <div className="mt-[2px] h-[4px] overflow-hidden rounded-full bg-[#16242f]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${f.weight}%`,
                      background: f.correlation >= 0 ? "#14e2a0" : "#ff4a68",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded border border-line-soft bg-[#08111a] px-2.5 py-2">
            <div className="text-[9.5px] text-brand">เหตุผลของการปรับน้ำหนัก</div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
              โมเดล<span className="text-up">เพิ่มน้ำหนักให้ {top?.th}</span> เพราะเป็นฟีเจอร์ที่
              สัมพันธ์กับผลตอบแทนล่วงหน้า {horizon} แท่งมากที่สุด (r = {top?.correlation.toFixed(3)}) และ
              <span className="text-down"> ลดน้ำหนักของ {bottom?.th}</span> ลงเหลือ{" "}
              {bottom?.weight.toFixed(1)}% เพราะค่าสหสัมพันธ์เหลือเพียง{" "}
              {bottom?.correlation.toFixed(3)} จากตัวอย่าง {top?.samples.toLocaleString()} จุด —
              การเปลี่ยนแปลงทุกครั้งย้อนกลับไปตรวจสอบกับข้อมูลดิบได้
            </p>
          </div>
        </>
      )}
    </Panel>
  );
}

/** Sections 9 + 10 — the knowledge graph and what the system remembers. */
export function KnowledgePanel({ rules }: { rules: LearnedRule[] }) {
  return (
    <Panel
      title="ความรู้ที่ AI สะสมไว้"
      titleEn="Knowledge Graph & AI Memory"
      right={
        <Tag tone="up">
          จำไว้ใช้ {rules.filter((r) => r.verdict === "จำไว้ใช้").length} รูปแบบ
        </Tag>
      }
      bodyClassName="p-0"
    >
      {rules.length === 0 ? (
        <p className="px-3 py-8 text-center text-[11px] text-dim">
          ต้องมีข้อมูลย้อนหลังมากกว่านี้จึงจะขุดรูปแบบได้
        </p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {rules.map((r) => {
            const edge = r.winRate >= 55 ? "up" : r.winRate <= 45 ? "down" : "neutral";
            return (
              <li key={r.id} className="px-3 py-[7px]">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${
                      edge === "up" ? "bg-up" : edge === "down" ? "bg-down" : "bg-[#33505f]"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate text-[10.5px]">{r.th}</span>
                  <span
                    className={`num shrink-0 text-[10.5px] font-bold ${
                      edge === "up" ? "text-up" : edge === "down" ? "text-down" : "text-muted"
                    }`}
                  >
                    {r.winRate.toFixed(0)}%
                  </span>
                  <Tag tone={r.verdict === "จำไว้ใช้" ? "up" : r.verdict === "ระวัง" ? "warn" : "neutral"}>
                    {r.verdict}
                  </Tag>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[9px] text-dim">
                  <span>พบ {r.hits} ครั้ง</span>
                  <span>
                    ผลตอบแทนเฉลี่ยหลังเกิดเหตุ{" "}
                    <span className={r.avgReturn >= 0 ? "text-up" : "text-down"}>
                      {fmtPct(r.avgReturn)}
                    </span>
                  </span>
                  <span className="ml-auto">จาก {r.samples.toLocaleString()} แท่ง</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        แต่ละบรรทัดคือความรู้ที่ขุดจากข้อมูลจริง — &quot;เมื่อเงื่อนไขนี้เกิดขึ้น
        ราคาหลังจากนั้นเป็นอย่างไร&quot; ระบบเก็บไว้ใช้ตัดสินใจ และคำนวณใหม่ได้ทุกเมื่อ
      </p>
    </Panel>
  );
}

/** Section 14 — drift monitoring. */
export function DriftPanel({
  drifts,
  needsRetrain,
  accuracyDrop,
}: {
  drifts: Drift[];
  needsRetrain: boolean;
  accuracyDrop: number;
}) {
  return (
    <Panel
      title="เฝ้าระวังการเสื่อมของโมเดล"
      titleEn="AI Health Monitor"
      right={
        <Tag tone={needsRetrain ? "down" : "up"}>
          {needsRetrain ? "ควรฝึกใหม่" : "ยังใช้ได้"}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-1.5"
    >
      {drifts.map((d) => (
        <div key={d.key}>
          <div className="flex justify-between text-[10px]">
            <span className={d.alert ? "text-down" : "text-muted"}>
              {d.th} <span className="text-[8.5px] text-dim">{d.en}</span>
            </span>
            <span className={`num font-semibold ${d.alert ? "text-down" : "text-txt"}`}>
              {d.value.toFixed(1)}
              <span className="text-[8.5px] text-dim"> / {d.threshold}</span>
            </span>
          </div>
          <div className="mt-[2px] h-[4px] overflow-hidden rounded-full bg-[#16242f]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (d.value / d.threshold) * 100)}%`,
                background: d.alert ? "#ff4a68" : "#14e2a0",
              }}
            />
          </div>
          <div className="truncate text-[8.5px] text-dim">{d.detail}</div>
        </div>
      ))}

      <p
        className={`mt-1 border-t border-line-soft pt-1.5 text-[9.5px] leading-snug ${
          needsRetrain ? "text-warn" : "text-dim"
        }`}
      >
        {needsRetrain
          ? `ความแม่นยำลดลง ${accuracyDrop.toFixed(1)}% ระหว่างครึ่งแรกกับครึ่งหลังของข้อมูล — ระบบเสนอให้ฝึกโมเดลใหม่ แต่ต้องผ่าน Backtest → Walk Forward → Paper → Shadow ก่อน Deploy`
          : "ทุกมิติยังอยู่ใต้เกณฑ์เตือน — โมเดลปัจจุบันยังสอดคล้องกับสภาพตลาด"}
      </p>
    </Panel>
  );
}

/** Section 5 — the reinforcement signal. */
export function RewardPanel({ events }: { events: RewardEvent[] }) {
  const positive = events.filter((e) => e.reward > 0).length;

  return (
    <Panel
      title="การเรียนรู้จากผลจริง"
      titleEn="Reinforcement Learning"
      right={
        <Tag tone={positive >= events.length / 2 ? "up" : "down"}>
          รางวัลบวก {positive}/{events.length}
        </Tag>
      }
      bodyClassName="p-0"
    >
      {events.length === 0 ? (
        <p className="px-3 py-8 text-center text-[11px] text-dim">
          ยังไม่มีไม้ที่ปิดแล้วสำหรับป้อนกลับเข้าโมเดล
        </p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {events.map((e, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-[6px] text-[10.5px]">
              <span className="w-[52px] shrink-0 text-muted">
                {e.symbol.replace("USDT", "")}
              </span>
              <Tag tone={e.side === "LONG" ? "up" : "down"}>{e.side}</Tag>
              <span
                className={`num w-[62px] shrink-0 text-right ${
                  e.returnPct >= 0 ? "text-up" : "text-down"
                }`}
              >
                {fmtPct(e.returnPct)}
              </span>
              <span className="h-[4px] flex-1 overflow-hidden rounded-full bg-[#16242f]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.abs(e.reward) * 100}%`,
                    marginLeft: e.reward < 0 ? "auto" : undefined,
                    background: e.reward >= 0 ? "#14e2a0" : "#ff4a68",
                  }}
                />
              </span>
              <span
                className={`num w-[46px] shrink-0 text-right ${
                  e.reward >= 0 ? "text-up" : "text-down"
                }`}
              >
                {e.reward >= 0 ? "+" : ""}
                {e.reward.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        รางวัลคือค่า R-multiple ของไม้ที่ปิดจริงในการทดสอบ ตัดขอบไว้ที่ ±1 แบบเดียวกับที่
        RL agent ใช้ — การปรับน้ำหนักจากสัญญาณนี้ต้องผ่านการทดสอบก่อนเสมอ
        ไม่อัปเดตโมเดล Production โดยตรง
      </p>
    </Panel>
  );
}

/** The Chief AI Research Scientist's backlog. */
export function ResearchPanel({ tasks }: { tasks: ResearchTask[] }) {
  return (
    <Panel
      title="หัวหน้านักวิจัย AI"
      titleEn="AI Research Scientist"
      right={<Tag tone="warn">เสนอได้ · Deploy เองไม่ได้</Tag>}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {tasks.map((t) => (
          <li key={t.id} className="px-3 py-[7px]">
            <div className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded border px-1.5 py-[1px] text-[8.5px] ${
                  t.priority === "สูง"
                    ? "border-down/40 text-down"
                    : t.priority === "กลาง"
                      ? "border-warn/40 text-warn"
                      : "border-line text-dim"
                }`}
              >
                {t.priority}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10.5px] text-txt">{t.th}</span>
            </div>
            <p className="mt-0.5 text-[9.5px] leading-snug text-muted">{t.reason}</p>
          </li>
        ))}
      </ul>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        AI ตัวนี้ไม่เทรดและไม่มีสิทธิ์ Deploy — ข้อเสนอทุกข้อต้องผ่าน
        Research → Backtest → Walk Forward → Monte Carlo → Paper → Shadow → Risk Review →
        ผู้ดูแลอนุมัติ ก่อนขึ้น Production
      </p>
    </Panel>
  );
}
