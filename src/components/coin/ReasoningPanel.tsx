"use client";

import { useState } from "react";
import { fmtPrice } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import type { CoinScore, Consensus, EntryPlan, OnChain } from "@/lib/scoring";
import type { Micro } from "@/lib/use-coin-intel";
import { Panel, Tag } from "../Panel";

/**
 * Writes the case in plain Thai from the numbers already on screen — the same
 * evidence, stated as prose, including what argues against the trade.
 */
function explain(
  base: string,
  score: CoinScore,
  cons: Consensus,
  plan: EntryPlan | null,
  micro: Micro,
  onchain: OnChain,
  regimeTh: string,
): string[] {
  const strong = [...score.parts].sort((a, b) => b.value - a.value).slice(0, 3);
  const weak = [...score.parts].sort((a, b) => a.value - b.value).slice(0, 2);
  const wall = micro.bids.length
    ? [...micro.bids].sort((a, b) => b.qty - a.qty)[0]
    : null;

  const out: string[] = [];

  out.push(
    `${base} อยู่ในสภาวะ${regimeTh} คะแนนรวมจากการวิเคราะห์ 9 ด้านอยู่ที่ ${score.total} จาก 100 ` +
      `ซึ่งจัดอยู่ในระดับ "${score.verdictTh}"`,
  );

  out.push(
    `สัญญาณที่หนุนมากที่สุดคือ${strong.map((s) => `${s.th} (${s.value.toFixed(0)})`).join(" · ")} ` +
      `โดยเฉพาะ${strong[0].th}ที่อ่านค่าได้ว่า ${strong[0].detail}`,
  );

  if (wall) {
    out.push(
      `ฝั่งสภาพคล่องพบกำแพงคำสั่งซื้อหนาที่ระดับ ${fmtPrice(wall.price)} ` +
        `ซึ่งทำหน้าที่เป็นแนวรับใกล้ที่สุดหากราคาย่อลงมา`,
    );
  }

  out.push(
    cons.split
      ? `อย่างไรก็ตาม AI ในระบบยังเห็นไม่ตรงกัน (${cons.long} ต่อ ${cons.short}) ซึ่งเป็นสัญญาณว่าตลาดยังไม่มีทิศทางชัดเจน`
      : `AI ในระบบเห็นพ้องกันในระดับ ${cons.agreementPct}% — ${cons.headline}`,
  );

  out.push(
    `จุดที่ต้องระวังคือ${weak.map((w) => `${w.th} (${w.value.toFixed(0)})`).join(" และ ")} ` +
      `โดย${weak[0].th}อ่านค่าได้ว่า ${weak[0].detail}`,
  );

  if (onchain.fearGreed !== null) {
    out.push(
      `บรรยากาศตลาดโดยรวมอยู่ที่ระดับ ${onchain.fearGreed} (${onchain.fearGreedLabel}) ` +
        `ซึ่ง${onchain.fearGreed < 40 ? "สะท้อนความกลัวและมักเป็นจังหวะที่ราคาผันผวนสูง" : onchain.fearGreed > 60 ? "สะท้อนความโลภ ควรระวังการกลับตัว" : "อยู่ในเกณฑ์ปกติ"}`,
    );
  }

  if (plan && plan.direction !== "WAIT") {
    out.push(
      `ด้วยเหตุผลข้างต้น AI จึงเสนอเปิดสถานะ ${plan.direction} ที่ ${fmtPrice(plan.entry)} ` +
        `ตัดขาดทุนที่ ${fmtPrice(plan.stop)} และทยอยทำกำไรที่ ${plan.targets.map((t) => fmtPrice(t.price)).join(" / ")} ` +
        `โดยจำกัดความเสี่ยงไม่เกิน ${plan.riskPct}% ของพอร์ต ที่อัตราส่วนผลตอบแทนต่อความเสี่ยง 1:${plan.rr}`,
    );
  } else {
    out.push(
      `เมื่อชั่งน้ำหนักทั้งหมดแล้ว หลักฐานยังไม่มากพอในทิศทางใดทิศทางหนึ่ง ` +
        `AI จึงแนะนำให้รอจังหวะที่สัญญาณสอดคล้องกันมากกว่านี้ก่อนเข้าเทรด`,
    );
  }

  return out;
}

export function ReasoningPanel({
  score,
  consensus,
  plan,
  micro,
  onchain,
}: {
  score: CoinScore;
  consensus: Consensus;
  plan: EntryPlan | null;
  micro: Micro;
  onchain: OnChain;
}) {
  const { symbol, regime } = useMarket();
  const [open, setOpen] = useState(true);
  const base = symbol.replace(/USDT$/, "");
  const lines = explain(base, score, consensus, plan, micro, onchain, regime.labelTh);

  return (
    <Panel
      title="AI อธิบายเหตุผล"
      titleEn="AI Reasoning"
      right={<Tag tone="up">อ้างอิงตัวเลขจริงบนหน้านี้</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-brand/40 bg-[#062a38] py-1.5 text-[11px] font-semibold text-brand hover:bg-[#083545]"
      >
        {open ? "ย่อคำอธิบาย" : "Explain Decision — ให้ AI อธิบายการตัดสินใจ"}
      </button>

      {open && (
        <div className="space-y-1.5 rounded border border-line-soft bg-[#08111a] p-2.5">
          {lines.map((l, i) => (
            <p key={i} className="text-[10.5px] leading-relaxed text-muted">
              <span className="mr-1 text-brand">{i + 1}.</span>
              {l}
            </p>
          ))}
          <p className="border-t border-line-soft pt-1.5 text-[9px] text-dim">
            คำอธิบายนี้สร้างจากตัวเลขชุดเดียวกับที่แสดงบนหน้านี้ทั้งหมด
            ไม่ได้เรียกโมเดลภาษาภายนอก — ทุกประโยคตรวจย้อนกลับไปยังแผงที่เกี่ยวข้องได้
          </p>
        </div>
      )}
    </Panel>
  );
}
