"use client";

import { fmtPrice } from "@/lib/format";
import { Panel, Tag } from "../Panel";
import { useExec } from "./ExecProvider";

/** Millisecond-resolution timestamp for the execution recorder. */
function ms(at: number) {
  const d = new Date(at);
  return `${d.toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Bangkok" })}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

/** Sections 7 + Smart Execution Replay — every step of the selected order. */
export function ExecutionTimeline() {
  const { selected } = useExec();

  return (
    <Panel
      title="ไทม์ไลน์การส่งคำสั่ง"
      titleEn="Execution Timeline"
      right={<Tag tone="up">ความละเอียดระดับมิลลิวินาที</Tag>}
      bodyClassName="p-2.5"
    >
      {!selected || selected.steps.length === 0 ? (
        <p className="py-10 text-center text-[11px] text-dim">
          ส่งคำสั่งเพื่อบันทึกไทม์ไลน์ระดับมิลลิวินาที
        </p>
      ) : (
        <>
          <ol className="space-y-0">
            {selected.steps.map((s, i) => {
              const prev = i > 0 ? selected.steps[i - 1].at : s.at;
              const delta = s.at - prev;
              return (
                <li key={`${s.at}-${s.label}`} className="flex gap-2.5">
                  <span className="relative flex w-3 shrink-0 flex-col items-center">
                    <span className="mt-[6px] size-[7px] shrink-0 rounded-full bg-brand shadow-[0_0_6px_rgba(0,212,255,0.8)]" />
                    {i < selected.steps.length - 1 && (
                      <span className="w-[1px] flex-1 bg-line-soft" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 pb-2">
                    <span className="flex items-baseline gap-2">
                      <span className="num text-[9.5px] text-dim">{ms(s.at)}</span>
                      <span className="truncate text-[10.5px] font-medium text-brand">
                        {s.labelTh}
                      </span>
                      <span className="truncate text-[9px] text-dim">{s.label}</span>
                      {i > 0 && (
                        <span className="num ml-auto shrink-0 text-[9px] text-muted">
                          +{delta} ms
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[9.5px] text-muted">{s.detail}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="border-t border-line-soft pt-1.5 text-[9px] text-dim">
            รวมเวลาตั้งแต่สร้างคำสั่งจนจับคู่:{" "}
            <span className="num text-txt">
              {selected.steps.at(-1)!.at - selected.steps[0].at} ms
            </span>{" "}
            · ช่วงที่รอ exchange ตอบกลับใช้เวลาจริงที่วัดได้จาก API ของ venue นั้น
          </p>
        </>
      )}
    </Panel>
  );
}

/** Sections 9 + 10 — the engine's record and its self-assessment. */
export function ExecutionStats() {
  const { stats, quality } = useExec();

  const rows: [string, string, string?][] = [
    ["คำสั่งทั้งหมด Executed", `${stats.total}`],
    ["อัตราจับคู่ Fill Rate", `${stats.fillRate.toFixed(2)}%`],
    ["Latency เฉลี่ย", stats.avgLatency ? `${stats.avgLatency.toFixed(0)} ms` : "—"],
    ["Slippage เฉลี่ย", stats.avgSlippage ? `${stats.avgSlippage.toFixed(4)}%` : "—"],
    ["ถูกปฏิเสธ Rejected", `${stats.rejected}`],
    ["จับคู่บางส่วน Partial", `${stats.partial}`],
    ["Maker / Taker", `${stats.makerPct.toFixed(0)}% / ${(100 - stats.makerPct).toFixed(0)}%`],
    ["ค่าธรรมเนียมเฉลี่ย", stats.avgFee ? `${stats.avgFee.toFixed(3)}%` : "—"],
  ];

  const scores: [string, number][] = [
    ["Execution Score", quality.execution],
    ["Routing Score", quality.routing],
    ["Liquidity Score", quality.liquidity],
    ["Slippage Score", quality.slippage],
    ["Fill Quality", quality.fillQuality],
  ];

  return (
    <Panel
      title="สถิติและคุณภาพการส่งคำสั่ง"
      titleEn="Execution Statistics & AI Analysis"
      right={
        <Tag tone={quality.overall >= 70 ? "up" : quality.overall >= 55 ? "warn" : "down"}>
          {quality.verdict} {quality.overall.toFixed(0)}%
        </Tag>
      }
      bodyClassName="p-2.5 grid gap-3 md:grid-cols-2"
    >
      <div>
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex justify-between border-b border-line-soft py-[4px] text-[10.5px] last:border-0"
          >
            <span className="text-dim">{k}</span>
            <span className="num text-txt">{v}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {scores.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted">{k}</span>
              <span
                className="num font-bold"
                style={{ color: v >= 80 ? "#14e2a0" : v >= 60 ? "#ffb020" : "#ff4a68" }}
              >
                {v.toFixed(0)}%
              </span>
            </div>
            <div className="mt-[2px] h-[4px] overflow-hidden rounded-full bg-[#16242f]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${v}%`,
                  background: v >= 80 ? "#14e2a0" : v >= 60 ? "#ffb020" : "#ff4a68",
                }}
              />
            </div>
          </div>
        ))}
        <p className="pt-1 text-[9px] leading-snug text-dim">
          ทุกคะแนนคำนวณจากคำสั่งที่ระบบส่งจริงในเซสชันนี้ — ไม่มีค่าคงที่
          หากยังไม่มีคำสั่ง คะแนนจะอิงจากสภาพ venue ปัจจุบันเท่านั้น
        </p>
      </div>
    </Panel>
  );
}

/** Section 11 — the routing board, ranked live. */
export function RoutingPanel() {
  const { routing, venues } = useExec();

  return (
    <Panel
      title="เลือกตลาดอัตโนมัติ"
      titleEn="Smart Order Routing"
      right={
        <Tag tone={routing ? "up" : "down"}>
          {routing ? `เลือก ${routing.venue.name}` : "ไม่มี venue"}
        </Tag>
      }
      bodyClassName="p-0"
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[9px] uppercase tracking-wide text-dim">
            <th className="px-3 py-1.5 font-medium">Exchange</th>
            <th className="px-2 py-1.5 text-right font-medium">ราคา</th>
            <th className="px-2 py-1.5 text-right font-medium">Latency</th>
            <th className="px-2 py-1.5 text-right font-medium">Fee</th>
            <th className="px-2 py-1.5 text-right font-medium">Liquidity</th>
            <th className="px-2 py-1.5 text-right font-medium">คะแนน</th>
            <th className="px-3 py-1.5 font-medium">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {(routing?.ranked ?? []).map((r, i) => (
            <tr key={r.venue.id} className="border-t border-line-soft text-[10.5px]">
              <td className="px-3 py-[6px]">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-up" />
                  {r.venue.name}
                </span>
              </td>
              <td className="num px-2 py-[6px] text-right">
                {r.venue.price ? fmtPrice(r.venue.price) : "—"}
              </td>
              <td className="num px-2 py-[6px] text-right text-muted">{r.venue.latency} ms</td>
              <td className="num px-2 py-[6px] text-right text-muted">{r.venue.fee}%</td>
              <td className="num px-2 py-[6px] text-right text-muted">
                {r.liquidity.toFixed(0)}
              </td>
              <td className="num px-2 py-[6px] text-right font-bold text-brand">
                {r.score.toFixed(1)}
              </td>
              <td className="px-3 py-[6px]">
                <Tag tone={i === 0 ? "up" : "neutral"}>{i === 0 ? "BEST" : "GOOD"}</Tag>
              </td>
            </tr>
          ))}
          {venues
            .filter((v) => !v.online)
            .map((v) => (
              <tr key={v.id} className="border-t border-line-soft text-[10.5px] opacity-60">
                <td className="px-3 py-[6px]">
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-down" />
                    {v.name}
                  </span>
                </td>
                <td className="px-2 py-[6px] text-right text-dim">—</td>
                <td className="num px-2 py-[6px] text-right text-dim">{v.latency} ms</td>
                <td className="num px-2 py-[6px] text-right text-dim">{v.fee}%</td>
                <td className="px-2 py-[6px] text-right text-dim">—</td>
                <td className="px-2 py-[6px] text-right text-dim">—</td>
                <td className="px-3 py-[6px]">
                  <Tag tone="down">เชื่อมต่อไม่ได้</Tag>
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        ราคาและ latency ดึงจาก public API ของแต่ละ exchange จริงทุก 20 วินาที ·
        venue ที่ติดต่อไม่ได้จะถูกตัดออกจากการเลือกเสมอ ไม่ใช้ค่าประมาณแทน
      </p>
    </Panel>
  );
}
