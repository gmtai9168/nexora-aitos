/**
 * The AI Council — every one of the 50 agents given a real job.
 *
 * Each agent is a pure function of a live feature bundle (computed from real
 * market data in server/features.ts). Directional agents emit a signed vote in
 * [-1, 1] with a confidence; the rest are honest monitors/gates that report a
 * real reading without pretending to pick a side. Master AI aggregates the
 * directional votes weighted by each agent's *earned* weight (its track record
 * from the learning memory), so influence is proportional to proven usefulness
 * and a useless agent fades on its own.
 *
 * Honesty notes:
 *   • The ML pod runs real lightweight statistical models (weighted feature
 *     combinations / threshold ensembles), not deep-learning networks — a
 *     browser/serverless app can't truthfully run a Transformer. Labelled as
 *     "โมเดลสถิติ" in the UI.
 *   • Risk / execution / safety agents don't vote a direction — they report
 *     posture and the real gate stays the Risk Engine + testnet lock in runCycle.
 *   • Not 50 independent edges: many read the same feed. Weighting + honest
 *     monitors are the point, not manufacturing 50 different signals.
 */

export type Features = {
  symbol: string;
  price: number;
  slope: number; // (EMA12-EMA34)/EMA34 %
  rsi: number;
  atrPct: number;
  adx: number;
  macdHist: number;
  bbPctB: number;
  roc: number;
  emaStack: number; // -1..1
  higherTrend: number; // -1/0/1
  regimeBias: number; // -1/0/1
  regimeConf: number; // 0-100
  volRatio: number; // last vol / avg
  liquidity: number; // 0-100
  funding: number | null;
  oiChangePct: number | null;
  takerBuyShare: number | null;
  longShare: number | null;
  obImbalance: number | null;
  basis: number | null;
  spreadBps: number | null;
  dvol: number | null;
  fng: number | null;
  whaleBuyShare: number | null;
  delta: number | null;
  newsBias: number; // -1/0/1
  newsImpact: number; // 0-100
  newsDeep: boolean;
  recentBias: number; // -1..1, direction that has been paying lately
  marginRatio: number | null;
  dayPnlPct: number | null;
  openPositions: number;
  maxPositions: number;
  completeness: number; // 0-100, share of futures features present
};

export type AgentVote = {
  id: string;
  kind: "direction" | "monitor";
  vote: number; // -1..1 (0 for monitors)
  confidence: number; // 0-100
  note: string;
  ok?: boolean; // monitors that also carry a pass/fail posture
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const tanh = (z: number) => Math.tanh(z);

function d(id: string, vote: number, note: string): AgentVote {
  const v = clamp(vote, -1, 1);
  return { id, kind: "direction", vote: v, confidence: Math.round(clamp(50 + Math.abs(v) * 46, 50, 99)), note };
}
function mon(id: string, note: string, ok?: boolean): AgentVote {
  return { id, kind: "monitor", vote: 0, confidence: 0, note, ok };
}

const dirTh = (v: number | null, refUp: string, refDown: string) =>
  v === null ? "—" : v > 0 ? refUp : v < 0 ? refDown : "กลาง";

/* ------------------------------------------------------------------ *
 * The 50 evaluators, keyed by agent id (`${pod}-${index}`).
 * ------------------------------------------------------------------ */

export const EVALUATORS: Record<string, (f: Features) => AgentVote> = {
  /* ---- data pod ---- */
  "data-0": (f) => d("data-0", tanh(f.slope * 4 + f.emaStack), `เทรนด์ราคา slope ${f.slope.toFixed(2)}%`),
  "data-1": (f) =>
    f.obImbalance === null ? mon("data-1", "ไม่มีข้อมูลบุ๊ก") : d("data-1", clamp(f.obImbalance / 40, -1, 1), `บุ๊ก ${f.obImbalance > 0 ? "ซื้อหนา" : "ขายหนา"} ${Math.abs(f.obImbalance).toFixed(0)}%`),
  "data-2": (f) => d("data-2", f.newsBias * (f.newsImpact / 100), `ข่าว ${dirTh(f.newsBias, "บวก", "ลบ")} แรง ${f.newsImpact}${f.newsDeep ? " (AI)" : ""}`),
  "data-3": () => mon("data-3", "ออนเชนรอเงินจริง (ยังไม่มีคีย์)"), // dormant
  "data-4": (f) => mon("data-4", `ความครบข้อมูล ${f.completeness}%`, f.completeness >= 60),

  /* ---- trend pod ---- */
  "trend-0": (f) => d("trend-0", tanh(f.higherTrend * 1.2 + f.emaStack), `TF ใหญ่ ${dirTh(f.higherTrend, "ขึ้น", "ลง")} · สแต็ก EMA ${f.emaStack.toFixed(2)}`),
  "trend-1": (f) => d("trend-1", tanh(f.slope * 5 + Math.sign(f.macdHist) * 0.4), `slope ${f.slope.toFixed(2)}% · MACD ${f.macdHist >= 0 ? "+" : ""}${f.macdHist.toFixed(4)}`),
  "trend-2": (f) => d("trend-2", tanh(f.roc * 0.14 + (f.rsi - 50) * 0.03), `ROC ${f.roc.toFixed(2)}% · RSI ${f.rsi.toFixed(0)}`),
  "trend-3": (f) => d("trend-3", f.adx < 20 ? clamp((0.5 - f.bbPctB) * 2, -1, 1) : clamp((f.bbPctB - 0.5) * 2, -1, 1), `${f.adx < 20 ? "แกว่ง-กลับค่าเฉลี่ย" : "ตามแนวโน้ม"} %B ${f.bbPctB.toFixed(2)}`),
  "trend-4": (f) => mon("trend-4", `ความผันผวน ATR ${f.atrPct.toFixed(2)}%${f.dvol !== null ? ` · DVOL ${f.dvol.toFixed(0)}` : ""}`, f.atrPct < 3),
  "trend-5": (f) => d("trend-5", f.regimeBias * (f.regimeConf / 100), `สภาวะ ${dirTh(f.regimeBias, "ขาขึ้น", "ขาลง")} มั่นใจ ${f.regimeConf}%`),

  /* ---- smart money pod ---- */
  "smart-0": (f) => mon("smart-0", f.liquidity !== null ? `สภาพคล่อง ${f.liquidity}/100${f.spreadBps !== null ? ` · สเปรด ${f.spreadBps.toFixed(1)}bps` : ""}` : "—", (f.liquidity ?? 0) >= 55),
  "smart-1": (f) => f.takerBuyShare === null ? mon("smart-1", "ไม่มีข้อมูลโฟลว์") : d("smart-1", clamp((f.takerBuyShare - 50) / 25, -1, 1), `แรงเคาะซื้อ ${f.takerBuyShare.toFixed(0)}%`),
  "smart-2": (f) => f.whaleBuyShare === null ? mon("smart-2", "ไม่มีไม้ใหญ่") : d("smart-2", clamp((f.whaleBuyShare - 50) / 22, -1, 1), `วาฬฝั่งซื้อ ${f.whaleBuyShare.toFixed(0)}%`),
  "smart-3": (f) => f.delta === null ? mon("smart-3", "—") : d("smart-3", clamp(Math.sign(f.delta) * Math.min(1, Math.abs(f.delta) / 5e6), -1, 1), `เดลตา ${f.delta >= 0 ? "+" : ""}${(f.delta / 1e6).toFixed(2)}M`),
  "smart-4": (f) => f.delta === null ? mon("smart-4", "—") : d("smart-4", clamp((f.delta / 8e6), -1, 1), `แรงสุทธิผู้เคาะ ${(f.delta / 1e6).toFixed(2)}M`),
  "smart-5": (f) => mon("smart-5", f.spreadBps !== null ? `MM สเปรด ${f.spreadBps.toFixed(1)}bps` : "—", (f.spreadBps ?? 99) < 6),

  /* ---- futures pod ---- */
  "futures-0": (f) => f.funding === null ? mon("futures-0", "—") : d("futures-0", clamp(-f.funding / 0.05, -1, 1), `Funding ${f.funding.toFixed(4)}% (${f.funding > 0 ? "ล็องจ่าย→ค้าน" : "ช็อตจ่าย→หนุน"})`),
  "futures-1": (f) => f.oiChangePct === null ? mon("futures-1", "—") : d("futures-1", clamp((f.oiChangePct / 3) * Math.sign(f.slope || 1), -1, 1), `OI ${f.oiChangePct >= 0 ? "+" : ""}${f.oiChangePct.toFixed(1)}%`),
  "futures-2": (f) => f.longShare === null ? mon("futures-2", "—") : d("futures-2", clamp((50 - f.longShare) / 18, -1, 1), `บัญชีล็อง ${f.longShare.toFixed(0)}% (สวนฝูงชน)`),
  "futures-3": (f) => f.basis === null ? mon("futures-3", "—") : d("futures-3", clamp(-f.basis / 0.15, -1, 1), `เบสิส ${f.basis.toFixed(3)}%`),
  "futures-4": (f) => {
    const squeeze = f.longShare !== null && f.funding !== null ? (f.longShare > 60 && f.funding > 0.03 ? "เสี่ยงบีบล็อง" : f.longShare < 40 && f.funding < -0.03 ? "เสี่ยงบีบช็อต" : "ปกติ") : "—";
    return mon("futures-4", `โซนบังคับปิด (ประมาณ): ${squeeze}`);
  },
  "futures-5": (f) => mon("futures-5", f.basis !== null ? `พรีเมียมสัญญา ${f.basis.toFixed(3)}%` : "—"),

  /* ---- pattern pod ---- */
  "pattern-0": (f) => d("pattern-0", f.bbPctB > 1 ? 0.7 : f.bbPctB < 0 ? -0.7 : clamp((f.bbPctB - 0.5) * 1.2, -1, 1), `เบรกเอาต์ %B ${f.bbPctB.toFixed(2)}`),
  "pattern-1": (f) => d("pattern-1", f.rsi > 70 ? -0.7 : f.rsi < 30 ? 0.7 : clamp((50 - f.rsi) / 40, -1, 1), `กลับค่าเฉลี่ย RSI ${f.rsi.toFixed(0)}`),
  "pattern-2": (f) => d("pattern-2", tanh(Math.sign(f.macdHist) * 0.5 + (f.rsi - 50) * 0.02), `สแกลป์ MACD ${f.macdHist >= 0 ? "+" : "−"}`),
  "pattern-3": (f) => d("pattern-3", tanh(f.higherTrend + f.slope * 3), `สวิงตาม TF ใหญ่ ${dirTh(f.higherTrend, "ขึ้น", "ลง")}`),
  "pattern-4": (f) => mon("pattern-4", `กริดเหมาะกับตลาดแกว่ง — ADX ${f.adx.toFixed(0)}`, f.adx < 20),
  "pattern-5": (f) => mon("pattern-5", f.basis !== null ? `อาร์บสปอต-ฟิวเจอร์ส ${f.basis.toFixed(3)}%` : "—"),

  /* ---- ML pod (real lightweight statistical models, honestly labelled) ---- */
  // Attention-style weighted blend over multi-timeframe features.
  "ml-0": (f) => d("ml-0", tanh(0.9 * f.emaStack + 0.8 * f.higherTrend + 0.6 * Math.sign(f.macdHist) + 0.4 * ((f.rsi - 50) / 20)), "โมเดลสถิติ: ผสมหลายไทม์เฟรม"),
  // Sequence-momentum model.
  "ml-1": (f) => d("ml-1", tanh(0.15 * f.roc + 0.9 * Math.sign(f.macdHist) * Math.min(1, Math.abs(f.macdHist) * 50) + 0.03 * (f.rsi - 50)), "โมเดลสถิติ: โมเมนตัมต่อเนื่อง"),
  // Gradient-boosted-style threshold ensemble: majority of binary feature votes.
  "ml-2": (f) => {
    const votes = [
      f.rsi > 50, f.macdHist > 0, f.emaStack > 0, f.slope > 0,
      (f.obImbalance ?? 0) > 0, (f.takerBuyShare ?? 50) > 50,
      (f.funding ?? 0) < 0, (f.longShare ?? 50) < 50, (f.whaleBuyShare ?? 50) > 50,
      f.higherTrend > 0,
    ];
    const up = votes.filter(Boolean).length;
    return d("ml-2", clamp((up - votes.length / 2) / (votes.length / 2), -1, 1), `โมเดลสถิติ: โหวตฟีเจอร์ ${up}/${votes.length} ขึ้น`);
  },
  // Reward-weighted: leans toward the direction that has been paying lately.
  "ml-3": (f) => d("ml-3", tanh(1.1 * f.recentBias + 0.5 * f.emaStack), `โมเดลสถิติ: เสริมแรงจากผลล่าสุด (${f.recentBias >= 0 ? "+" : ""}${f.recentBias.toFixed(2)})`),
  // Ensemble: average of the four models above.
  "ml-4": (f) => {
    const parts = ["ml-0", "ml-1", "ml-2", "ml-3"].map((id) => EVALUATORS[id](f).vote);
    return d("ml-4", parts.reduce((a, b) => a + b, 0) / parts.length, "โมเดลสถิติ: รวมสี่โมเดล");
  },

  /* ---- risk pod (monitors — the real gate is the Risk Engine in runCycle) ---- */
  "risk-0": (f) => mon("risk-0", `ขนาดไม้ตาม ATR ${f.atrPct.toFixed(2)}% → ${f.atrPct > 2.5 ? "ลดขนาด" : "ปกติ"}`),
  "risk-1": (f) => mon("risk-1", f.marginRatio !== null ? `มาร์จิน ${f.marginRatio.toFixed(0)}%` : "มาร์จินต่ำ", (f.marginRatio ?? 0) < 55),
  "risk-2": (f) => mon("risk-2", `เลเวอเรจแนะนำ ${f.atrPct > 2 ? "ต่ำ" : "ปานกลาง"} (ผันผวน ${f.atrPct.toFixed(1)}%)`),
  "risk-3": (f) => mon("risk-3", `สถานะเปิด ${f.openPositions}/${f.maxPositions}`, f.openPositions < f.maxPositions),
  "risk-4": (f) => mon("risk-4", f.dayPnlPct !== null ? `P&L วันนี้ ${f.dayPnlPct >= 0 ? "+" : ""}${f.dayPnlPct.toFixed(2)}%` : "—", (f.dayPnlPct ?? 0) > -3),

  /* ---- self-learning pod (drives the weighting — its real influence) ---- */
  "learn-0": (f) => mon("learn-0", `ทิศทางที่ได้ผลล่าสุด ${f.recentBias >= 0.1 ? "ขึ้น" : f.recentBias <= -0.1 ? "ลง" : "กลาง"}`),
  "learn-1": () => mon("learn-1", "ปรับน้ำหนักโหวตจากผลจริง (แอ็กทีฟ)"),
  "learn-2": () => mon("learn-2", "เลือกโมเดลตามคะแนนความน่าเชื่อถือ"),
  "learn-3": () => mon("learn-3", "อัปเดตความจำหลังปิดออเดอร์"),

  /* ---- master pod ---- */
  "master-0": () => mon("master-0", "รวมมติทั้งคณะ (ดูผลด้านล่าง)"),
  "master-1": (f) => mon("master-1", "ประตูความเสี่ยง: ใช้ Risk Engine + เพดานสถานะจริง", (f.marginRatio ?? 0) < 55 && (f.dayPnlPct ?? 0) > -2.5),
  "master-2": () => mon("master-2", "เทสต์เน็ต/PAPER ล็อกไว้ — ไม่มีคีย์จริง ไม่ส่งออเดอร์จริง", true),

  /* ---- execution pod (monitors — real order handling is in runCycle) ---- */
  "exec-0": (f) => mon("exec-0", f.spreadBps !== null ? `ส่งคำสั่ง: สเปรด ${f.spreadBps.toFixed(1)}bps` : "พร้อมส่ง"),
  "exec-1": (f) => mon("exec-1", f.spreadBps !== null ? `สลิปเพจคาด ~${(f.spreadBps / 2).toFixed(1)}bps` : "—", (f.spreadBps ?? 99) < 8),
  "exec-2": (f) => mon("exec-2", `ปรับคำสั่งตามสภาพคล่อง ${f.liquidity}/100`),
  "exec-3": () => mon("exec-3", "MARKET order — ไม่วัดความหน่วงจริง (เทสต์เน็ต)"),
};

/* ------------------------------------------------------------------ *
 * Aggregation — Master AI
 * ------------------------------------------------------------------ */

export type CouncilResult = {
  dir: "LONG" | "SHORT" | null;
  confidence: number;
  supporting: number;
  against: number;
  net: number; // -1..1
  votes: AgentVote[];
};

/**
 * Weighs every directional vote by its confidence and earned weight, then
 * reads the net. weightOf(id) comes from the learning memory (default 1).
 */
export function runCouncil(f: Features, weightOf: (id: string) => number = () => 1): CouncilResult {
  const votes = Object.keys(EVALUATORS).map((id) => EVALUATORS[id](f));

  let net = 0;
  let W = 0;
  let supporting = 0;
  let against = 0;
  for (const v of votes) {
    if (v.kind !== "direction") continue;
    const w = Math.max(0, weightOf(v.id)) * (v.confidence / 100);
    net += v.vote * w;
    W += w;
    if (v.vote > 0.12) supporting++;
    else if (v.vote < -0.12) against++;
  }
  const score = W ? net / W : 0;
  const dir = score > 0.12 ? "LONG" : score < -0.12 ? "SHORT" : null;
  const confidence = Math.round(clamp(50 + Math.abs(score) * 46, 0, 97));

  return { dir, confidence, supporting, against, net: score, votes };
}
