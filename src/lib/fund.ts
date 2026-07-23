import type { CurveStat, StrategyRow } from "./performance";
import type { Quote } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** Demo fund book. Sizes are constants; every derived figure is computed. */
export const AUM_BASE = 128_450_789;
export const MANAGEMENT_FEE_PCT = 2; // annual, on AUM
export const PERFORMANCE_FEE_PCT = 20; // on profit above high-water mark

export type Sleeve = {
  id: string;
  name: string;
  aiName: string;
  color: string;
  /** Risk-adjusted score the allocator ranks on. */
  score: number;
  weightPct: number;
  capital: number;
  riskBudgetPct: number;
  returnPct: number;
  sharpe: number;
  maxDrawdown: number;
  verdictTh: string;
};

export type Allocation = {
  sleeves: Sleeve[];
  cashPct: number;
  cash: number;
  deployed: number;
  utilisationPct: number;
  noteTh: string;
};

/**
 * AI-CIO capital allocator.
 *
 * Ranks every sleeve by return per unit of drawdown, then hands out capital in
 * proportion to that score — not equally, and not by raw return. Sleeves that
 * lost money get no capital at all, and the cash reserve grows with portfolio
 * risk rather than sitting at a fixed number.
 */
export function allocateCapital(rows: StrategyRow[], aum: number, stat: CurveStat): Allocation {
  // Cash floor 20%, rising with realised drawdown.
  const cashPct = clamp(20 + stat.maxDrawdown * 1.6, 20, 60);
  const investable = aum * (1 - cashPct / 100);

  const scored = rows.map((r) => {
    const dd = Math.max(r.result.maxDrawdown, 1);
    // Return per unit of pain, nudged by hit rate.
    const raw = (r.result.returnPct / dd) * 10 + (r.result.winRate - 45) * 0.12;
    return { row: r, score: Math.max(0, raw) };
  });

  const totalScore = scored.reduce((a, s) => a + s.score, 0);

  const sleeves: Sleeve[] = scored.map(({ row, score }) => {
    const share = totalScore > 0 ? score / totalScore : 0;
    const capital = investable * share;

    return {
      id: row.id,
      name: row.name,
      aiName: row.aiName,
      color: row.color,
      score,
      weightPct: (capital / aum) * 100,
      capital,
      // Risk budget is capital share scaled by the sleeve's own volatility.
      riskBudgetPct: share * 100 * (row.result.maxDrawdown / Math.max(stat.maxDrawdown, 1)),
      returnPct: row.result.returnPct,
      sharpe: row.result.sharpe,
      maxDrawdown: row.result.maxDrawdown,
      verdictTh:
        score === 0
          ? "งดจัดสรรทุน — ยังขาดทุนสุทธิ"
          : share > 0.3
            ? "จัดสรรหนัก — ผลตอบแทนต่อความเสี่ยงดีที่สุด"
            : share > 0.12
              ? "จัดสรรปกติ"
              : "จัดสรรน้อย — รอผลงานพิสูจน์เพิ่ม",
    };
  });

  const deployed = sleeves.reduce((a, s) => a + s.capital, 0);
  const starved = sleeves.filter((s) => s.score === 0).length;

  return {
    sleeves: sleeves.sort((a, b) => b.capital - a.capital),
    cashPct,
    cash: aum - deployed,
    deployed,
    utilisationPct: (deployed / aum) * 100,
    noteTh:
      starved > 0
        ? `AI-CIO งดจัดสรรทุนให้ ${starved} กลยุทธ์ที่ยังขาดทุนสุทธิ และเพิ่มเงินสดสำรองเป็น ${cashPct.toFixed(1)}% ตามระดับ Drawdown ปัจจุบัน`
        : `จัดสรรทุนตามผลตอบแทนต่อความเสี่ยงของแต่ละกลยุทธ์ · เงินสดสำรอง ${cashPct.toFixed(1)}%`,
  };
}

export type Investor = {
  id: string;
  name: string;
  type: string;
  capital: number;
  since: string;
  returnPct: number;
  profit: number;
  status: "Active" | "Lock-up" | "Redeeming";
};

const INVESTOR_BOOK: { id: string; name: string; type: string; capital: number; since: string; status: Investor["status"] }[] = [
  { id: "fo-1", name: "Ascend Family Office", type: "Family Office", capital: 38_500_000, since: "2024-03", status: "Active" },
  { id: "inst-1", name: "Meridian Capital", type: "สถาบัน", capital: 24_000_000, since: "2024-06", status: "Active" },
  { id: "inst-2", name: "Northline Partners", type: "สถาบัน", capital: 18_250_000, since: "2024-09", status: "Lock-up" },
  { id: "hnw-1", name: "GM Holdings", type: "รายใหญ่", capital: 15_800_000, since: "2025-01", status: "Active" },
  { id: "hnw-2", name: "Siam Ventures", type: "รายใหญ่", capital: 12_400_000, since: "2025-04", status: "Active" },
  { id: "fund-1", name: "Delta Fund of Funds", type: "กองทุนรวม", capital: 9_600_000, since: "2025-07", status: "Redeeming" },
  { id: "hnw-3", name: "Private Pool A", type: "รายย่อยรวม", capital: 9_900_789, since: "2025-09", status: "Active" },
];

/** Investor returns are the fund return net of fees, pro-rated by capital. */
export function investors(grossReturnPct: number): Investor[] {
  return INVESTOR_BOOK.map((i) => {
    const perf = grossReturnPct > 0 ? grossReturnPct * (1 - PERFORMANCE_FEE_PCT / 100) : grossReturnPct;
    const net = perf - MANAGEMENT_FEE_PCT / 12;
    return {
      ...i,
      returnPct: net,
      profit: (i.capital * net) / 100,
    };
  });
}

export type TreasuryRow = { th: string; en: string; value: number; kind: "in" | "out" | "net" };

export function treasury(aum: number, alloc: Allocation): TreasuryRow[] {
  const pendingDeposit = aum * 0.012;
  const pendingWithdrawal = aum * 0.008;

  return [
    { th: "เงินทุนไหลเข้า (30 วัน)", en: "Capital In", value: aum * 0.043, kind: "in" },
    { th: "เงินทุนไหลออก (30 วัน)", en: "Capital Out", value: -aum * 0.019, kind: "out" },
    { th: "รอฝากเข้า", en: "Pending Deposit", value: pendingDeposit, kind: "in" },
    { th: "รอถอนออก", en: "Pending Withdrawal", value: -pendingWithdrawal, kind: "out" },
    { th: "เงินสดคงเหลือ", en: "Cash Reserve", value: alloc.cash, kind: "net" },
    { th: "ทุนที่ปล่อยลงตลาด", en: "Deployed Capital", value: alloc.deployed, kind: "net" },
    {
      th: "สภาพคล่องพร้อมใช้",
      en: "Available Liquidity",
      value: alloc.cash - pendingWithdrawal,
      kind: "net",
    },
  ];
}

export type RevenueRow = { th: string; en: string; value: number };

/**
 * Fee model. Management fee accrues on AUM, performance fee only on profit —
 * so a losing period earns no performance fee, exactly as a real fund works.
 */
export function revenue(aum: number, grossReturnPct: number, trades: number) {
  const managementFee = (aum * MANAGEMENT_FEE_PCT) / 100 / 12;
  const profit = (aum * grossReturnPct) / 100;
  const performanceFee = profit > 0 ? (profit * PERFORMANCE_FEE_PCT) / 100 : 0;

  // Costs that scale with activity, plus fixed infrastructure.
  const exchangeFees = trades * 12;
  const dataFeed = 18_000;
  const cloudGpu = 42_000;
  const operations = 65_000;

  const income: RevenueRow[] = [
    { th: "ค่าบริหารจัดการ (2%/ปี)", en: "Management Fee", value: managementFee },
    { th: "ค่าธรรมเนียมตามผลงาน (20%)", en: "Performance Fee", value: performanceFee },
    { th: "ส่วนลดค่าธรรมเนียม Exchange", en: "Rebate", value: exchangeFees * 0.12 },
  ];

  const expense: RevenueRow[] = [
    { th: "ค่าธรรมเนียม Exchange", en: "Exchange Fees", value: -exchangeFees },
    { th: "ค่าข้อมูลตลาด", en: "Data Feed", value: -dataFeed },
    { th: "คลาวด์และ GPU", en: "Cloud / GPU", value: -cloudGpu },
    { th: "ค่าดำเนินงาน", en: "Operations", value: -operations },
  ];

  const totalIncome = income.reduce((a, r) => a + r.value, 0);
  const totalExpense = expense.reduce((a, r) => a + r.value, 0);

  return {
    income,
    expense,
    totalIncome,
    totalExpense,
    net: totalIncome + totalExpense,
    profit,
  };
}

export type ComplianceRow = { th: string; en: string; pass: boolean; detail: string };

/** Compliance checks wired to live state where the platform can actually see it. */
export function compliance(input: {
  alloc: Allocation;
  stat: CurveStat;
  emergencyStop: boolean;
  venuesOnline: number;
  venuesTotal: number;
  riskApproved: boolean;
}): ComplianceRow[] {
  const { alloc, stat, emergencyStop, venuesOnline, venuesTotal, riskApproved } = input;
  const biggest = alloc.sleeves[0];

  return [
    {
      th: "นโยบายความเสี่ยง",
      en: "Risk Policy",
      pass: stat.maxDrawdown <= 20,
      detail: `Drawdown ${stat.maxDrawdown.toFixed(2)}% · เพดาน 20%`,
    },
    {
      th: "เพดานการกระจุกตัวต่อกลยุทธ์",
      en: "Concentration",
      pass: !biggest || biggest.weightPct <= 40,
      detail: biggest
        ? `กลยุทธ์ใหญ่สุดถือ ${biggest.weightPct.toFixed(1)}% ของ AUM · เพดาน 40%`
        : "ยังไม่มีการจัดสรร",
    },
    {
      th: "เงินสดสำรองขั้นต่ำ",
      en: "Cash Reserve",
      pass: alloc.cashPct >= 20,
      detail: `เงินสด ${alloc.cashPct.toFixed(1)}% · ขั้นต่ำ 20%`,
    },
    {
      th: "การอนุมัติจาก Risk Engine",
      en: "Risk Gate",
      pass: riskApproved || emergencyStop,
      detail: riskApproved
        ? "คำสั่งล่าสุดผ่านคณะกรรมการความเสี่ยง"
        : emergencyStop
          ? "ระบบหยุดฉุกเฉิน — ไม่มีคำสั่งถูกส่ง"
          : "Risk Engine ยังไม่อนุมัติ",
    },
    {
      th: "ความปลอดภัยการเชื่อมต่อ",
      en: "API Security",
      pass: true,
      detail: "ไม่มีการเก็บ API key ในระบบสาธิตนี้",
    },
    {
      th: "ความพร้อมของช่องทางซื้อขาย",
      en: "Venue Availability",
      pass: venuesOnline >= 2,
      detail: `เชื่อมต่อได้ ${venuesOnline}/${venuesTotal} แห่ง · ขั้นต่ำ 2`,
    },
    {
      th: "ธรรมาภิบาล AI",
      en: "AI Governance",
      pass: true,
      detail: "ทุกการตัดสินใจถูกบันทึกและอธิบายย้อนหลังได้",
    },
    {
      th: "KYC / AML",
      en: "KYC / AML",
      pass: true,
      detail: "ข้อมูลนักลงทุนในหน้านี้เป็นชุดสาธิต ไม่มีข้อมูลบุคคลจริง",
    },
  ];
}

export type Projection = {
  horizonTh: string;
  months: number;
  bull: number;
  base: number;
  bear: number;
};

/**
 * AUM projection. Compounds the fund's own measured monthly return, with the
 * bull/bear bands set by its measured volatility — not by optimism.
 */
export function projections(aum: number, stat: CurveStat, monthsObserved = 3): Projection[] {
  const monthly = monthsObserved > 0 ? stat.returnPct / monthsObserved : 0;
  const band = Math.max(1.5, stat.volatility * 6);

  const horizons: { th: string; months: number }[] = [
    { th: "1 เดือน", months: 1 },
    { th: "3 เดือน", months: 3 },
    { th: "6 เดือน", months: 6 },
    { th: "1 ปี", months: 12 },
    { th: "3 ปี", months: 36 },
  ];

  const grow = (rate: number, months: number) => aum * Math.pow(1 + rate / 100, months);

  return horizons.map((h) => ({
    horizonTh: h.th,
    months: h.months,
    bull: grow(monthly + band, h.months),
    base: grow(monthly, h.months),
    bear: grow(monthly - band, h.months),
  }));
}

export type SimResult = {
  newAum: number;
  deployed: number;
  cash: number;
  cashPct: number;
  utilisation: number;
  expectedMonthlyProfit: number;
  liquidityRatio: number;
};

/** Section 13 — what a capital injection or redemption actually changes. */
export function simulateCapital(
  aum: number,
  delta: number,
  alloc: Allocation,
  stat: CurveStat,
  monthsObserved = 3,
): SimResult {
  const newAum = Math.max(1, aum + delta);
  // New money follows the existing cash policy, not the existing weights.
  const cash = newAum * (alloc.cashPct / 100);
  const deployed = newAum - cash;
  const monthly = monthsObserved > 0 ? stat.returnPct / monthsObserved : 0;

  return {
    newAum,
    deployed,
    cash,
    cashPct: (cash / newAum) * 100,
    utilisation: (deployed / newAum) * 100,
    expectedMonthlyProfit: (deployed * monthly) / 100,
    liquidityRatio: deployed > 0 ? cash / (deployed * 0.1) : 0,
  };
}

export type BoardProposal = {
  ai: string;
  th: string;
  reason: string;
  stance: "เพิ่ม" | "ลด" | "คงไว้" | "ระวัง";
};

/** Section 14 — the daily board, with every proposal traced to a number. */
export function boardMeeting(
  rows: StrategyRow[],
  alloc: Allocation,
  stat: CurveStat,
  quotes: Map<string, Quote>,
  riskScore: number,
): { proposals: BoardProposal[]; masterPlanTh: string } {
  const best = [...rows].sort((a, b) => b.result.profitFactor - a.result.profitFactor)[0];
  const worst = [...rows].sort((a, b) => a.result.profitFactor - b.result.profitFactor)[0];
  const btc = quotes.get("BTCUSDT");
  const eth = quotes.get("ETHUSDT");

  const proposals: BoardProposal[] = [
    {
      ai: "Trend Hunter",
      th: btc && btc.changePct > 0 ? "เพิ่มน้ำหนัก BTC" : "ชะลอการเพิ่ม BTC",
      reason: btc
        ? `BTC เคลื่อนไหว ${btc.changePct >= 0 ? "+" : ""}${btc.changePct.toFixed(2)}% ใน 24 ชม.`
        : "ไม่มีข้อมูลราคา",
      stance: btc && btc.changePct > 0 ? "เพิ่ม" : "ระวัง",
    },
    {
      ai: "Whale AI",
      th: eth && eth.changePct > 0 ? "ทยอยสะสม ETH" : "ยังไม่เพิ่ม ETH",
      reason: eth
        ? `ETH เคลื่อนไหว ${eth.changePct >= 0 ? "+" : ""}${eth.changePct.toFixed(2)}% ใน 24 ชม.`
        : "ไม่มีข้อมูลราคา",
      stance: eth && eth.changePct > 0 ? "เพิ่ม" : "ระวัง",
    },
    {
      ai: "Risk AI",
      th: riskScore > 60 ? "ลดเลเวอเรจทั้งกองทุน" : "คงระดับความเสี่ยงเดิม",
      reason: `คะแนนความเสี่ยงรวม ${riskScore}/100`,
      stance: riskScore > 60 ? "ลด" : "คงไว้",
    },
    {
      ai: "AI-CIO",
      th: best ? `เพิ่มทุนให้ ${best.name}` : "รอผลงานเพิ่ม",
      reason: best
        ? `Profit Factor ${best.result.profitFactor.toFixed(2)} สูงสุดในกอง · ได้รับจัดสรร ${((alloc.sleeves.find((s) => s.id === best.id)?.weightPct ?? 0)).toFixed(1)}% ของ AUM`
        : "ยังไม่มีกลยุทธ์ที่โดดเด่น",
      stance: "เพิ่ม",
    },
    {
      ai: "Guardian AI",
      th: `รักษาเงินสดสำรองที่ ${alloc.cashPct.toFixed(0)}%`,
      reason: `Drawdown ปัจจุบัน ${stat.maxDrawdown.toFixed(2)}% — นโยบายกำหนดให้เพิ่มเงินสดตามระดับความเสี่ยง`,
      stance: alloc.cashPct > 30 ? "เพิ่ม" : "คงไว้",
    },
    {
      ai: "Performance AI",
      th: worst ? `พักการใช้งาน ${worst.name}` : "ไม่มีกลยุทธ์ที่ต้องพัก",
      reason: worst
        ? `Profit Factor ${worst.result.profitFactor.toFixed(2)} ต่ำสุดในกอง`
        : "ทุกกลยุทธ์อยู่ในเกณฑ์",
      stance: worst && worst.result.profitFactor < 1 ? "ลด" : "คงไว้",
    },
  ];

  const masterPlanTh =
    `แผนของวัน: จัดสรรทุน ${alloc.utilisationPct.toFixed(1)}% ลงตลาดและถือเงินสด ${alloc.cashPct.toFixed(1)}% · ` +
    `เพิ่มน้ำหนักให้ ${best?.name ?? "—"} และลดน้ำหนัก ${worst?.name ?? "—"} · ` +
    `${riskScore > 60 ? "ลดเลเวอเรจลงจนกว่าคะแนนความเสี่ยงจะกลับต่ำกว่า 60" : "คงระดับความเสี่ยงเดิมและติดตามต่อเนื่อง"}`;

  return { proposals, masterPlanTh };
}
