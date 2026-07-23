import type { Allocation, Investor } from "./fund";
import { AUM_BASE } from "./fund";
import type { CurveStat, StrategyRow } from "./performance";
import type { GlobalRisk } from "./risk-engine";
import type { ServerHealth } from "./sysops";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export type Financials = {
  managementFee: number;
  performanceFee: number;
  otherIncome: number;
  totalRevenue: number;
  infrastructure: number;
  dataAndFeeds: number;
  people: number;
  exchangeFees: number;
  totalCost: number;
  ebitda: number;
  ebitdaMarginPct: number;
  netProfit: number;
  cashOnHand: number;
  runwayMonths: number;
};

/**
 * Company P&L. Fee income is driven by the fund's measured return, so a losing
 * month earns no performance fee and the margin compresses on its own.
 */
export function financials(
  aum: number,
  grossReturnPct: number,
  trades: number,
  nodes: number,
): Financials {
  const managementFee = (aum * 0.02) / 12;
  const profit = (aum * grossReturnPct) / 100;
  const performanceFee = profit > 0 ? profit * 0.2 : 0;
  const otherIncome = trades * 1.4;

  const infrastructure = nodes * 96 + nodes * 24 * 30 * 0.42 + 480 + 210;
  const dataAndFeeds = 18_000;
  const people = 185_000;
  const exchangeFees = trades * 12;

  const totalRevenue = managementFee + performanceFee + otherIncome;
  const totalCost = infrastructure + dataAndFeeds + people + exchangeFees;
  const ebitda = totalRevenue - totalCost;
  const netProfit = ebitda * 0.85;
  const cashOnHand = 4_200_000;

  return {
    managementFee,
    performanceFee,
    otherIncome,
    totalRevenue,
    infrastructure,
    dataAndFeeds,
    people,
    exchangeFees,
    totalCost,
    ebitda,
    ebitdaMarginPct: totalRevenue ? (ebitda / totalRevenue) * 100 : 0,
    netProfit,
    cashOnHand,
    // Runway only matters when the company is burning cash.
    runwayMonths: ebitda >= 0 ? Infinity : cashOnHand / Math.abs(ebitda),
  };
}

export type ForecastRow = {
  horizonTh: string;
  months: number;
  aum: { bear: number; base: number; bull: number };
  revenue: { bear: number; base: number; bull: number };
  clients: { bear: number; base: number; bull: number };
};

/**
 * Company forecast. AUM compounds the fund's measured monthly return plus a
 * client-inflow assumption; revenue follows AUM because fees are a function of
 * it. Bands widen with the fund's own measured volatility.
 */
export function forecast(
  aum: number,
  stat: CurveStat,
  clients: number,
  monthsObserved = 3,
): ForecastRow[] {
  const monthlyReturn = monthsObserved > 0 ? stat.returnPct / monthsObserved : 0;
  const band = Math.max(2, stat.volatility * 6);
  const inflowBase = 2.5;

  const horizons: { th: string; months: number }[] = [
    { th: "1 เดือน", months: 1 },
    { th: "3 เดือน", months: 3 },
    { th: "6 เดือน", months: 6 },
    { th: "1 ปี", months: 12 },
    { th: "3 ปี", months: 36 },
    { th: "5 ปี", months: 60 },
  ];

  const grow = (base: number, rate: number, months: number) =>
    base * Math.pow(1 + rate / 100, months);

  return horizons.map((h) => {
    const aumOf = (r: number) => grow(aum, monthlyReturn + inflowBase + r, h.months);
    const clientsOf = (r: number) =>
      Math.round(grow(clients, Math.max(0, 3 + r / 2), h.months));

    return {
      horizonTh: h.th,
      months: h.months,
      aum: { bear: aumOf(-band), base: aumOf(0), bull: aumOf(band) },
      // Fees are ~2%/yr of AUM plus performance, so revenue tracks AUM.
      revenue: {
        bear: (aumOf(-band) * 0.02) / 12,
        base: (aumOf(0) * 0.02) / 12,
        bull: (aumOf(band) * 0.032) / 12,
      },
      clients: { bear: clientsOf(-band), base: clientsOf(0), bull: clientsOf(band) },
    };
  });
}

export type BoardSeat = {
  officer: string;
  role: string;
  proposalTh: string;
  reasonTh: string;
  stance: "เพิ่ม" | "ลด" | "คงไว้" | "ระวัง";
};

/** Sections 9 — the nightly board of AI officers. */
export function boardRoom(input: {
  rows: StrategyRow[];
  alloc: Allocation;
  stat: CurveStat;
  global: GlobalRisk;
  fin: Financials;
  health: ServerHealth;
  heapPct: number;
}): { seats: BoardSeat[]; ceoPlanTh: string } {
  const { rows, alloc, stat, global, fin, heapPct } = input;
  const best = [...rows].sort((a, b) => b.result.profitFactor - a.result.profitFactor)[0];
  const worst = [...rows].sort((a, b) => a.result.profitFactor - b.result.profitFactor)[0];

  const seats: BoardSeat[] = [
    {
      officer: "Master AI",
      role: "หัวหน้าฝ่ายเทรด",
      proposalTh: best ? `เพิ่มน้ำหนักให้ ${best.name}` : "รอสัญญาณที่ชัดเจนกว่านี้",
      reasonTh: best
        ? `Profit Factor ${best.result.profitFactor.toFixed(2)} · ผลตอบแทน ${best.result.returnPct.toFixed(2)}%`
        : "ยังไม่มีกลยุทธ์ที่โดดเด่นในช่วงที่วัด",
      stance: best && best.result.profitFactor > 1.2 ? "เพิ่ม" : "คงไว้",
    },
    {
      officer: "Risk AI",
      role: "หัวหน้าความเสี่ยง",
      proposalTh:
        global.score > 60 ? "ลดเลเวอเรจทั้งองค์กร" : "คงกรอบความเสี่ยงเดิม",
      reasonTh: `คะแนนความเสี่ยงรวม ${global.score}/100 · Drawdown ${stat.maxDrawdown.toFixed(2)}%`,
      stance: global.score > 60 ? "ลด" : "คงไว้",
    },
    {
      officer: "AI-CIO",
      role: "หัวหน้าการลงทุน",
      proposalTh: `ถือเงินสด ${alloc.cashPct.toFixed(0)}% และงดจัดสรรทุนให้กลยุทธ์ที่ยังขาดทุน`,
      reasonTh: alloc.noteTh,
      stance: alloc.cashPct > 30 ? "เพิ่ม" : "คงไว้",
    },
    {
      officer: "AI-CTO",
      role: "หัวหน้าเทคโนโลยี",
      proposalTh:
        heapPct > 75 ? "ขยายทรัพยากรเซิร์ฟเวอร์ก่อนเพิ่มโหลด" : "โครงสร้างพื้นฐานยังรองรับได้",
      reasonTh: `หน่วยความจำโปรเซสใช้ไป ${heapPct.toFixed(0)}% · ต้นทุนโครงสร้างพื้นฐาน ${Math.round(fin.infrastructure).toLocaleString()} USD/เดือน`,
      stance: heapPct > 75 ? "เพิ่ม" : "คงไว้",
    },
    {
      officer: "Performance AI",
      role: "หัวหน้าประเมินผล",
      proposalTh: worst ? `พักการใช้งาน ${worst.name}` : "ไม่มีกลยุทธ์ที่ต้องพัก",
      reasonTh: worst
        ? `Profit Factor ${worst.result.profitFactor.toFixed(2)} ต่ำสุดในกลุ่ม`
        : "ทุกกลยุทธ์อยู่ในเกณฑ์",
      stance: worst && worst.result.profitFactor < 1 ? "ลด" : "คงไว้",
    },
    {
      officer: "AI-CFO",
      role: "หัวหน้าการเงิน",
      proposalTh:
        fin.ebitda < 0 ? "ควบคุมต้นทุนและเร่งหารายได้เพิ่ม" : "คงโครงสร้างต้นทุนเดิม",
      reasonTh: `EBITDA ${Math.round(fin.ebitda).toLocaleString()} USD/เดือน · อัตรากำไร ${fin.ebitdaMarginPct.toFixed(1)}%`,
      stance: fin.ebitda < 0 ? "ลด" : "คงไว้",
    },
  ];

  const ceoPlanTh =
    `แผนของ Digital CEO: ` +
    `${global.score > 60 ? "ลดความเสี่ยงเป็นอันดับแรก" : "เดินหน้าตามแผนเดิม"} · ` +
    `จัดสรรทุนลงตลาด ${alloc.utilisationPct.toFixed(0)}% และถือเงินสด ${alloc.cashPct.toFixed(0)}% · ` +
    `${best ? `เพิ่มน้ำหนัก ${best.name}` : "ยังไม่เพิ่มน้ำหนักกลยุทธ์ใด"}${worst ? ` และพัก ${worst.name}` : ""} · ` +
    `${fin.ebitda >= 0 ? `ธุรกิจยังทำกำไร EBITDA ${Math.round(fin.ebitda).toLocaleString()} USD/เดือน` : "ธุรกิจยังขาดทุน ต้องคุมต้นทุนอย่างเข้มงวด"}`;

  return { seats, ceoPlanTh };
}

export type TwinDecision = {
  key: string;
  th: string;
  detailTh: string;
};

export const COMPANY_DECISIONS: TwinDecision[] = [
  { key: "none", th: "ไม่เปลี่ยนแปลง", detailTh: "ดำเนินการตามแผนปัจจุบัน" },
  { key: "capital", th: "รับเงินทุนเพิ่ม 100M USD", detailTh: "ขยาย AUM จากนักลงทุนสถาบัน" },
  { key: "agents", th: "เพิ่ม AI อีก 50 ตัว", detailTh: "ขยายกองเอเจนต์เป็นสองเท่า" },
  { key: "market", th: "เปิดตลาดใหม่ (Forex / หุ้น)", detailTh: "ขยายสินทรัพย์ที่ครอบคลุม" },
  { key: "both", th: "เพิ่มทุน 100M + AI 50 ตัว", detailTh: "ขยายทั้งเงินทุนและกำลังประมวลผล" },
];

export type CompanyTwin = {
  decision: TwinDecision;
  aum: number;
  revenue: number;
  cost: number;
  ebitda: number;
  ebitdaDelta: number;
  riskDelta: number;
  nodesNeeded: number;
  nodesAvailable: number;
  headcountDelta: number;
  verdictTh: string;
  ok: boolean;
};

/**
 * Company Digital Twin. Re-derives revenue, cost, risk and infrastructure need
 * for a hypothetical decision using the same formulas the live page uses, so
 * the comparison is apples to apples.
 */
export function companyTwin(
  decision: TwinDecision,
  base: { aum: number; fin: Financials; nodes: number; riskScore: number; agents: number },
  grossReturnPct: number,
  trades: number,
): CompanyTwin {
  let aum = base.aum;
  let agents = base.agents;
  let markets = 1;
  let headcountDelta = 0;

  if (decision.key === "capital" || decision.key === "both") aum += 100_000_000;
  if (decision.key === "agents" || decision.key === "both") agents += 50;
  if (decision.key === "market") {
    markets = 2;
    headcountDelta = 4;
  }
  if (decision.key === "both") headcountDelta = 3;

  // Node count scales with the agent fleet.
  const nodesNeeded = Math.ceil((agents / base.agents) * base.nodes * markets);
  const fin = financials(aum, grossReturnPct, trades * markets, nodesNeeded);
  const cost = fin.totalCost + headcountDelta * 14_000;
  const ebitda = fin.totalRevenue - cost;

  // More capital at the same policy raises absolute exposure, not the ratio;
  // more markets raises correlation risk.
  const riskDelta =
    (decision.key === "capital" || decision.key === "both" ? 4 : 0) +
    (decision.key === "market" ? 7 : 0) +
    (decision.key === "agents" ? 2 : 0);

  const ok = ebitda >= base.fin.ebitda && nodesNeeded <= base.nodes * 3;

  return {
    decision,
    aum,
    revenue: fin.totalRevenue,
    cost,
    ebitda,
    ebitdaDelta: ebitda - base.fin.ebitda,
    riskDelta,
    nodesNeeded,
    nodesAvailable: base.nodes,
    headcountDelta,
    ok,
    verdictTh:
      decision.key === "none"
        ? "สถานะปัจจุบัน ใช้เป็นฐานเปรียบเทียบ"
        : ok
          ? `คุ้มค่า · EBITDA เปลี่ยน ${ebitda - base.fin.ebitda >= 0 ? "+" : ""}${Math.round(ebitda - base.fin.ebitda).toLocaleString()} USD/เดือน แต่ต้องขยายเป็น ${nodesNeeded} โหนด`
          : `ยังไม่คุ้ม · EBITDA เปลี่ยน ${Math.round(ebitda - base.fin.ebitda).toLocaleString()} USD/เดือน และความเสี่ยงเพิ่ม ${riskDelta} คะแนน`,
  };
}

export type StrategicMove = {
  th: string;
  reasonTh: string;
  horizonTh: string;
  priority: "สูง" | "กลาง" | "ต่ำ";
};

export function strategicMoves(input: {
  rows: StrategyRow[];
  alloc: Allocation;
  stat: CurveStat;
  global: GlobalRisk;
  fin: Financials;
  twins: CompanyTwin[];
  venuesDown: number;
}): StrategicMove[] {
  const { rows, alloc, stat, global, fin, twins, venuesDown } = input;
  const out: StrategicMove[] = [];

  const starved = alloc.sleeves.filter((s) => s.capital === 0).length;
  if (starved > 0) {
    out.push({
      th: `ทบทวนหรือปลดระวางกลยุทธ์ที่ไม่ได้รับทุน ${starved} ตัว`,
      reasonTh: "AI-CIO งดจัดสรรทุนเพราะยังขาดทุนสุทธิในช่วงที่วัด",
      horizonTh: "ระยะสั้น",
      priority: "สูง",
    });
  }

  const bestTwin = [...twins]
    .filter((t) => t.decision.key !== "none")
    .sort((a, b) => b.ebitdaDelta - a.ebitdaDelta)[0];
  if (bestTwin && bestTwin.ebitdaDelta > 0) {
    out.push({
      th: bestTwin.decision.th,
      reasonTh: `ผลจำลอง: EBITDA เพิ่ม ${Math.round(bestTwin.ebitdaDelta).toLocaleString()} USD/เดือน · ความเสี่ยงเพิ่ม ${bestTwin.riskDelta} คะแนน`,
      horizonTh: "ระยะกลาง",
      priority: "สูง",
    });
  }

  if (venuesDown > 0) {
    out.push({
      th: `ขยายการเชื่อมต่อ exchange สำรอง ${venuesDown} แห่ง`,
      reasonTh: "มี venue ที่เข้าถึงไม่ได้จากเครือข่ายปัจจุบัน ทำให้เสียโอกาสด้านราคา",
      horizonTh: "ระยะสั้น",
      priority: "กลาง",
    });
  }

  if (fin.ebitdaMarginPct < 30) {
    out.push({
      th: "เพิ่ม AUM เพื่อกระจายต้นทุนคงที่",
      reasonTh: `อัตรากำไร EBITDA ${fin.ebitdaMarginPct.toFixed(1)}% · ต้นทุนคงที่คิดเป็นสัดส่วนสูงเมื่อเทียบกับรายได้`,
      horizonTh: "ระยะกลาง",
      priority: "สูง",
    });
  }

  const winners = rows.filter((r) => r.result.profitFactor > 1.2).length;
  if (winners < 3) {
    out.push({
      th: "เพิ่มจำนวนกลยุทธ์ที่ผ่านการพิสูจน์",
      reasonTh: `ปัจจุบันมีเพียง ${winners} กลยุทธ์ที่ Profit Factor เกิน 1.2 — พึ่งพากลยุทธ์น้อยเกินไป`,
      horizonTh: "ระยะกลาง",
      priority: "สูง",
    });
  }

  if (global.score <= 40 && stat.maxDrawdown < 12) {
    out.push({
      th: "พิจารณาเปิดรับนักลงทุนสถาบันเพิ่ม",
      reasonTh: `ความเสี่ยงอยู่ระดับต่ำ (${global.score}/100) และ Drawdown ${stat.maxDrawdown.toFixed(1)}% อยู่ในกรอบที่นำเสนอได้`,
      horizonTh: "ระยะยาว",
      priority: "กลาง",
    });
  }

  if (out.length === 0) {
    out.push({
      th: "รักษาแผนปัจจุบันและเก็บสถิติเพิ่ม",
      reasonTh: "ทุกตัวชี้วัดอยู่ในกรอบ ยังไม่มีเหตุให้เปลี่ยนทิศทางเชิงกลยุทธ์",
      horizonTh: "ระยะสั้น",
      priority: "ต่ำ",
    });
  }

  return out;
}

export type InvestorSegment = {
  type: string;
  count: number;
  capital: number;
  sharePct: number;
  behaviourTh: string;
};

export function investorIntelligence(rows: Investor[]): InvestorSegment[] {
  const total = rows.reduce((a, r) => a + r.capital, 0) || 1;
  const byType = new Map<string, { count: number; capital: number; redeeming: number }>();

  for (const r of rows) {
    const cur = byType.get(r.type) ?? { count: 0, capital: 0, redeeming: 0 };
    cur.count++;
    cur.capital += r.capital;
    if (r.status === "Redeeming") cur.redeeming++;
    byType.set(r.type, cur);
  }

  return [...byType.entries()]
    .map(([type, v]) => ({
      type,
      count: v.count,
      capital: v.capital,
      sharePct: (v.capital / total) * 100,
      behaviourTh:
        v.redeeming > 0
          ? `มี ${v.redeeming} รายกำลังขอถอนทุน — ควรติดตามใกล้ชิด`
          : v.capital / total > 0.25
            ? "ถือสัดส่วนสูง เป็นกลุ่มที่ต้องรายงานสม่ำเสมอ"
            : "ถือสัดส่วนปกติ ความเสี่ยงกระจุกตัวต่ำ",
    }))
    .sort((a, b) => b.capital - a.capital);
}

export type GlobalKpi = { th: string; en: string; value: string; scorePct: number };

export function globalKpis(input: {
  stat: CurveStat;
  benchStat: CurveStat;
  global: GlobalRisk;
  fin: Financials;
  health: ServerHealth;
  agentsOnline: number;
  agentsTotal: number;
  probesOk: number;
  probesTotal: number;
  investors: number;
}): GlobalKpi[] {
  const { stat, benchStat, global, fin, health, agentsOnline, agentsTotal, probesOk, probesTotal, investors } =
    input;
  const alpha = stat.returnPct - benchStat.returnPct;

  return [
    {
      th: "ผลตอบแทนเหนือเกณฑ์",
      en: "Alpha",
      value: `${alpha >= 0 ? "+" : ""}${alpha.toFixed(2)}%`,
      scorePct: clamp(50 + alpha * 2),
    },
    {
      th: "ความแม่นยำของ AI",
      en: "AI Accuracy",
      value: `${(50 + (stat.sharpe * 5)).toFixed(1)}%`,
      scorePct: clamp(50 + stat.sharpe * 5),
    },
    {
      th: "อัตรากำไร EBITDA",
      en: "EBITDA Margin",
      value: `${fin.ebitdaMarginPct.toFixed(1)}%`,
      scorePct: clamp(fin.ebitdaMarginPct),
    },
    {
      th: "คะแนนความเสี่ยง",
      en: "Risk Score",
      value: `${global.score}/100`,
      scorePct: clamp(100 - global.score),
    },
    {
      th: "ความพร้อมของ AI",
      en: "AI Availability",
      value: `${agentsOnline}/${agentsTotal}`,
      scorePct: clamp((agentsOnline / Math.max(agentsTotal, 1)) * 100),
    },
    {
      th: "ความพร้อมของระบบ",
      en: "System Health",
      value: probesTotal ? `${probesOk}/${probesTotal}` : "—",
      scorePct: probesTotal ? clamp((probesOk / probesTotal) * 100) : 0,
    },
    {
      th: "เวลาทำงานต่อเนื่อง",
      en: "Uptime",
      value: health.uptimeSec
        ? `${Math.floor(health.uptimeSec / 3600)} ชม.`
        : "—",
      scorePct: clamp((health.uptimeSec / 86400) * 100),
    },
    {
      th: "จำนวนนักลงทุน",
      en: "Investors",
      value: `${investors} ราย`,
      scorePct: clamp(investors * 8),
    },
  ];
}

export const EXECUTIVE_COMMANDS: { key: string; th: string; detailTh: string; tone: "up" | "warn" | "down" }[] = [
  { key: "reduce", th: "ลดความเสี่ยงทั้งองค์กร", detailTh: "ลดขนาดสถานะและเลเวอเรจลงครึ่งหนึ่ง", tone: "warn" },
  { key: "cash", th: "เพิ่มเงินสดสำรอง", detailTh: "ยกระดับเงินสดขั้นต่ำเป็น 40%", tone: "warn" },
  { key: "pause", th: "พัก AI ทั้งหมด", detailTh: "หยุดการวิเคราะห์และการส่งคำสั่ง", tone: "down" },
  { key: "deploy", th: "ปล่อยกลยุทธ์ที่ผ่านการทดสอบ", detailTh: "เลื่อนกลยุทธ์ใน Shadow ขึ้น Production", tone: "up" },
  { key: "report", th: "สร้างรายงานนักลงทุน", detailTh: "ส่งออกรายงานผลการดำเนินงานฉบับล่าสุด", tone: "up" },
  { key: "emergency", th: "โหมดฉุกเฉิน", detailTh: "หยุดทุกระบบทันทีทั้งแพลตฟอร์ม", tone: "down" },
];

/** Section 13 — a vision statement written from where the company actually is. */
export function aiVision(input: {
  stat: CurveStat;
  alloc: Allocation;
  fin: Financials;
  rows: StrategyRow[];
  global: GlobalRisk;
}): string {
  const { stat, alloc, fin, rows, global } = input;
  const proven = rows.filter((r) => r.result.profitFactor > 1.2).length;

  return (
    `เป้าหมาย 12 เดือนข้างหน้าคือการเพิ่มจำนวนกลยุทธ์ที่ผ่านการพิสูจน์จาก ${proven} เป็นอย่างน้อย ${Math.max(proven + 3, 5)} กลยุทธ์ ` +
    `เพื่อลดการพึ่งพากลยุทธ์เดี่ยว · ขยายสินทรัพย์ที่ครอบคลุมไปยังตลาดหุ้นและ Forex โดยใช้โครงสร้าง AI เดิม · ` +
    `รักษาความเสี่ยงรวมไม่ให้เกิน 60/100 (ปัจจุบัน ${global.score}) และ Drawdown ไม่เกิน 12% (ปัจจุบัน ${stat.maxDrawdown.toFixed(1)}%) · ` +
    `ยกระดับอัตรากำไร EBITDA จาก ${fin.ebitdaMarginPct.toFixed(0)}% ด้วยการขยาย AUM มากกว่าการเพิ่มต้นทุนคงที่ · ` +
    `คงวินัยเงินสดสำรองที่ ${alloc.cashPct.toFixed(0)}% เพื่อให้ระบบอยู่รอดในทุกสภาวะตลาด`
  );
}

export const COMPANY_AUM = AUM_BASE;
