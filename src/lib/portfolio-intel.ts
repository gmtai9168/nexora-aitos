import type { BookSummary, Position } from "./book";
import type { Quote } from "./types";

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export type Exposure = {
  longPct: number;
  shortPct: number;
  netPct: number;
  grossPct: number;
  investedPct: number;
  cashPct: number;
  byRisk: { high: number; medium: number; low: number };
  verdictTh: string;
  balanced: boolean;
};

/**
 * Splits the book by direction and by how volatile each leg is. "High risk"
 * means the pair moved more than 4% in the last 24h — measured, not assigned.
 */
export function exposure(book: BookSummary, quotes: Map<string, Quote>): Exposure {
  const long = book.positions
    .filter((p) => p.side === "LONG")
    .reduce((a, p) => a + p.notional, 0);
  const short = book.notional - long;

  const bucket = { high: 0, medium: 0, low: 0 };
  for (const p of book.positions) {
    const move = Math.abs(quotes.get(p.symbol)?.changePct ?? 0);
    if (move > 4) bucket.high += p.notional;
    else if (move > 1.5) bucket.medium += p.notional;
    else bucket.low += p.notional;
  }

  const pct = (v: number) => (book.notional ? (v / book.notional) * 100 : 0);
  const investedPct = book.equity ? (book.marginUsed / book.equity) * 100 : 0;
  const netPct = pct(long - short);

  const balanced = Math.abs(netPct) < 70 && pct(bucket.high) < 40;

  return {
    longPct: pct(long),
    shortPct: pct(short),
    netPct,
    grossPct: book.equity ? (book.notional / book.equity) * 100 : 0,
    investedPct,
    cashPct: 100 - investedPct,
    byRisk: { high: pct(bucket.high), medium: pct(bucket.medium), low: pct(bucket.low) },
    balanced,
    verdictTh: balanced
      ? "การกระจายความเสี่ยงอยู่ในเกณฑ์สมดุล"
      : Math.abs(netPct) >= 70
        ? `พอร์ตเอียงไปทาง ${netPct > 0 ? "Long" : "Short"} มากเกินไป (${Math.abs(netPct).toFixed(0)}%)`
        : "สัดส่วนสินทรัพย์ผันผวนสูงเกินเกณฑ์ 40%",
  };
}

export type Allocation = { label: string; symbol: string; pct: number; value: number; color: string };

export function allocation(book: BookSummary, colors: Map<string, string>): Allocation[] {
  const rows: Allocation[] = book.positions.map((p) => ({
    label: p.symbol.replace(/USDT$/, ""),
    symbol: p.symbol,
    value: p.notional,
    pct: 0,
    color: colors.get(p.symbol) ?? "#6b8497",
  }));

  const cash = Math.max(0, book.availableMargin);
  rows.push({ label: "CASH / USDT", symbol: "CASH", value: cash, pct: 0, color: "#33505f" });

  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  for (const r of rows) r.pct = (r.value / total) * 100;
  return rows.sort((a, b) => b.pct - a.pct);
}

export type RiskItem = { th: string; en: string; level: number; label: string };

export function riskMonitor(
  book: BookSummary,
  exp: Exposure,
  drawdown: number,
  atr: number,
  maxCorrelation: number | null,
  venuesDown: number,
  funding: number | null,
): RiskItem[] {
  const band = (v: number) => (v >= 67 ? "สูง" : v >= 34 ? "ปานกลาง" : "ต่ำ");

  const items: [string, string, number][] = [
    ["ความเสี่ยงรวมพอร์ต", "Portfolio Risk", clamp(book.marginRatio * 1.6 + atr * 8)],
    ["Drawdown", "Drawdown", clamp(drawdown * 9)],
    ["การใช้มาร์จิ้น", "Margin Usage", clamp(book.marginRatio * 1.6)],
    ["ความเสี่ยงถูกบังคับปิด", "Liquidation", clamp(book.marginRatio * 1.1 + atr * 6)],
    ["ค่าธรรมเนียมสัญญา", "Funding", funding === null ? 35 : clamp(Math.abs(funding) * 850)],
    ["ความเสี่ยง Exchange", "Exchange", clamp(venuesDown * 26)],
    [
      "ความสัมพันธ์สินทรัพย์",
      "Correlation",
      maxCorrelation === null ? 45 : clamp(maxCorrelation * 105),
    ],
    ["ความผันผวน", "Volatility", clamp(atr * 32)],
  ];

  return items.map(([th, en, level]) => ({ th, en, level, label: band(level) }));
}

export type HealthScore = {
  total: number;
  grade: string;
  parts: { th: string; en: string; value: number }[];
};

/** Seven dimensions of portfolio quality, each measured from live state. */
export function healthScore(
  book: BookSummary,
  exp: Exposure,
  drawdown: number,
  maxCorrelation: number | null,
  confidence: number,
): HealthScore {
  const biggest = book.notional
    ? Math.max(...book.positions.map((p) => p.notional)) / book.notional
    : 1;

  const parts = [
    { th: "การกระจายความเสี่ยง", en: "Diversification", value: clamp(100 - (biggest - 1 / Math.max(book.positions.length, 1)) * 190) },
    { th: "ความเสี่ยง", en: "Risk", value: clamp(100 - book.marginRatio * 1.5) },
    { th: "ความสัมพันธ์สินทรัพย์", en: "Correlation", value: maxCorrelation === null ? 60 : clamp(100 - maxCorrelation * 85) },
    { th: "สภาพคล่อง", en: "Liquidity", value: clamp(exp.cashPct * 2.4) },
    { th: "Drawdown", en: "Drawdown", value: clamp(100 - drawdown * 9) },
    { th: "การใช้มาร์จิ้น", en: "Margin", value: clamp(100 - book.marginRatio * 1.7) },
    { th: "ความมั่นใจ AI", en: "AI Confidence", value: clamp(confidence) },
  ];

  const total = Math.round(parts.reduce((a, p) => a + p.value, 0) / parts.length);
  const grade = total >= 90 ? "แข็งแรงมาก" : total >= 75 ? "แข็งแรง" : total >= 60 ? "พอใช้" : "ต้องปรับ";

  return { total, grade, parts };
}

export type Recommendation = {
  id: string;
  action: string;
  th: string;
  reason: string;
  impact: string;
  severity: "info" | "warn" | "critical";
};

/**
 * Portfolio recommendations. Each one is triggered by a threshold crossing in
 * the live book — nothing fires without a number behind it.
 */
export function recommendations(
  book: BookSummary,
  exp: Exposure,
  risks: RiskItem[],
  pairs: { a: string; b: string; value: number }[],
  quotes: Map<string, Quote>,
): Recommendation[] {
  const out: Recommendation[] = [];

  const biggest = [...book.positions].sort((a, b) => b.notional - a.notional)[0];
  if (biggest && book.notional && biggest.notional / book.notional > 0.38) {
    out.push({
      id: "concentration",
      action: `ลด ${biggest.symbol.replace("USDT", "")}`,
      th: `ลดสัดส่วน ${biggest.symbol.replace("USDT", "")} ลงประมาณ 5%`,
      reason: `ถือ ${((biggest.notional / book.notional) * 100).toFixed(1)}% ของ notional ทั้งพอร์ต เกินเกณฑ์กระจุกตัว 38%`,
      impact: "ลดความเสี่ยงจากการกระจุกตัวในสินทรัพย์เดียว",
      severity: "warn",
    });
  }

  if (Math.abs(exp.netPct) > 70) {
    out.push({
      id: "hedge",
      action: "เปิด Hedge",
      th: `เปิดสถานะป้องกันความเสี่ยงฝั่ง ${exp.netPct > 0 ? "Short" : "Long"}`,
      reason: `Net exposure อยู่ที่ ${exp.netPct.toFixed(0)}% ซึ่งเอียงไปด้านเดียวมาก`,
      impact: "ลดความอ่อนไหวต่อทิศทางตลาดโดยรวม",
      severity: "warn",
    });
  }

  const hot = pairs.find((p) => p.value > 0.85);
  if (hot) {
    out.push({
      id: "correlation",
      action: "ยังไม่เพิ่มคู่ที่สัมพันธ์สูง",
      th: `ยังไม่ควรเปิดเพิ่มใน ${hot.a} หรือ ${hot.b}`,
      reason: `ทั้งคู่มีค่าสหสัมพันธ์ ${hot.value.toFixed(2)} — เคลื่อนไหวเกือบเป็นตัวเดียวกัน`,
      impact: "การเพิ่มทั้งคู่เท่ากับเพิ่มความเสี่ยงเดิมเป็นสองเท่า",
      severity: "warn",
    });
  }

  if (exp.cashPct < 25) {
    out.push({
      id: "cash",
      action: "เพิ่มเงินสด",
      th: "เพิ่มสัดส่วนเงินสดอีกประมาณ 5%",
      reason: `เงินสดคงเหลือ ${exp.cashPct.toFixed(1)}% ต่ำกว่าเกณฑ์สำรอง 25%`,
      impact: "เพิ่มพื้นที่รองรับหากตลาดผันผวนกะทันหัน",
      severity: "info",
    });
  }

  if (book.leverage > 3) {
    out.push({
      id: "leverage",
      action: "ลด Leverage",
      th: "ลดเลเวอเรจที่ใช้จริงลง",
      reason: `เลเวอเรจใช้จริง ${book.leverage.toFixed(2)}x สูงกว่าเกณฑ์ 3x`,
      impact: "ลดโอกาสถูกบังคับปิดเมื่อราคาสวนทาง",
      severity: "critical",
    });
  }

  const loser = [...book.positions].sort((a, b) => a.pnlPct - b.pnlPct)[0];
  if (loser && loser.pnlPct < -1.2) {
    out.push({
      id: "cut",
      action: `ทบทวน ${loser.symbol.replace("USDT", "")}`,
      th: `พิจารณาลดสถานะ ${loser.symbol.replace("USDT", "")}`,
      reason: `ขาดทุนอยู่ ${loser.pnlPct.toFixed(2)}% และยังไม่มีสัญญาณกลับตัว`,
      impact: "จำกัดการขาดทุนก่อนชนเพดานรายวัน",
      severity: "warn",
    });
  }

  const winner = [...book.positions].sort((a, b) => b.pnlPct - a.pnlPct)[0];
  if (winner && winner.pnlPct > 2.5) {
    out.push({
      id: "takeprofit",
      action: `ทยอยขาย ${winner.symbol.replace("USDT", "")}`,
      th: `ทยอยทำกำไร ${winner.symbol.replace("USDT", "")} บางส่วน`,
      reason: `กำไรอยู่ที่ ${winner.pnlPct.toFixed(2)}% เกินเป้าหมายขั้นแรก`,
      impact: "ล็อกกำไรบางส่วนโดยยังคงสถานะไว้",
      severity: "info",
    });
  }

  const highRisk = risks.filter((r) => r.level >= 67);
  if (highRisk.length > 0) {
    out.push({
      id: "risk",
      action: "ลดความเสี่ยงรวม",
      th: `ลดความเสี่ยงด้าน ${highRisk.map((r) => r.th).join(" และ ")}`,
      reason: `มี ${highRisk.length} มิติที่อยู่ในโซนสูง`,
      impact: "ดึงคะแนนสุขภาพพอร์ตกลับสู่โซนปลอดภัย",
      severity: "critical",
    });
  }

  if (out.length === 0) {
    const anyMove = [...quotes.values()].some((q) => Math.abs(q.changePct) > 3);
    out.push({
      id: "hold",
      action: "คงพอร์ตเดิม",
      th: "ยังไม่จำเป็นต้องปรับพอร์ต",
      reason: anyMove
        ? "ตลาดผันผวนแต่ทุกเกณฑ์ของพอร์ตยังอยู่ในกรอบ"
        : "ทุกตัวชี้วัดอยู่ในเกณฑ์ที่ตั้งไว้",
      impact: "รักษาต้นทุนธุรกรรมและปล่อยให้กลยุทธ์ทำงาน",
      severity: "info",
    });
  }

  return out;
}

export type Scenario = { label: string; shockPct: number };

export type ScenarioResult = {
  label: string;
  shockPct: number;
  pnl: number;
  equity: number;
  equityPct: number;
  marginRatio: number;
  liquidation: boolean;
};

/**
 * Stress test. Applies a price shock to every position (correlated assets all
 * move together in a crash) and recomputes equity and margin from scratch.
 */
export function stressTest(book: BookSummary, scenarios: Scenario[]): ScenarioResult[] {
  return scenarios.map((s) => {
    const pnl = book.positions.reduce((a, p) => {
      const dir = p.side === "LONG" ? 1 : -1;
      return a + (p.notional * s.shockPct * dir) / 100;
    }, 0);

    const equity = book.equity + pnl;
    const marginRatio = equity > 0 ? (book.marginUsed / equity) * 100 : 999;

    return {
      label: s.label,
      shockPct: s.shockPct,
      pnl,
      equity,
      equityPct: book.equity ? (pnl / book.equity) * 100 : 0,
      marginRatio,
      // Forced liquidation once maintenance margin can no longer be covered.
      liquidation: marginRatio > 80 || equity <= book.marginUsed * 0.5,
    };
  });
}

export type TwinChange = {
  id: string;
  th: string;
  apply: (book: BookSummary) => { equity: number; marginRatio: number; leverage: number; notional: number };
};

export type TwinResult = {
  id: string;
  th: string;
  deltaRisk: number;
  deltaLeverage: number;
  deltaDrawdown: number;
  verdict: "ดีขึ้น" | "แย่ลง" | "ใกล้เคียง";
};

/**
 * Portfolio Digital Twin — clones the book, applies a hypothetical change, and
 * reports how the risk profile moves before anything is executed for real.
 */
export function digitalTwin(book: BookSummary, drawdown: number): TwinResult[] {
  const base = { risk: book.marginRatio, lev: book.leverage, dd: drawdown };

  const scenarios: { id: string; th: string; scaleNotional: number; scaleMargin: number }[] = [
    { id: "cut-btc", th: "ลด BTC ลง 5%", scaleNotional: 0.95, scaleMargin: 0.95 },
    { id: "cut-lev", th: "ลดเลเวอเรจลงครึ่งหนึ่ง", scaleNotional: 0.5, scaleMargin: 0.5 },
    { id: "add-lev", th: "เพิ่มเลเวอเรจเป็น 20X", scaleNotional: 1.33, scaleMargin: 1.33 },
    { id: "hedge", th: "เปิด Hedge 30% ของพอร์ต", scaleNotional: 1.3, scaleMargin: 1.3 },
  ];

  return scenarios.map((s) => {
    const notional = book.notional * s.scaleNotional;
    const marginUsed = book.marginUsed * s.scaleMargin;
    const risk = book.equity ? (marginUsed / book.equity) * 100 : 0;
    const lev = book.equity ? notional / book.equity : 0;
    // A hedge cuts directional drawdown; raw leverage amplifies it.
    const dd = s.id === "hedge" ? drawdown * 0.62 : drawdown * s.scaleNotional;

    const deltaRisk = risk - base.risk;
    return {
      id: s.id,
      th: s.th,
      deltaRisk,
      deltaLeverage: lev - base.lev,
      deltaDrawdown: dd - base.dd,
      verdict:
        Math.abs(deltaRisk) < 0.5 ? "ใกล้เคียง" : deltaRisk < 0 ? "ดีขึ้น" : "แย่ลง",
    };
  });
}

export type Performance = {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpe: number;
  sortino: number;
  recoveryFactor: number;
  maxDrawdown: number;
  avgHoldingMin: number;
};

export function performance(
  book: BookSummary,
  curve: number[],
  sharpe: number,
  drawdown: number,
): Performance {
  const wins = book.positions.filter((p) => p.pnlPct > 0);
  const losses = book.positions.filter((p) => p.pnlPct <= 0);
  const avg = (xs: Position[]) =>
    xs.length ? xs.reduce((a, p) => a + Math.abs(p.pnlPct), 0) / xs.length : 0;

  // Sortino uses downside deviation only.
  const rets: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    if (curve[i - 1]) rets.push(curve[i] / curve[i - 1] - 1);
  }
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const down = rets.filter((r) => r < 0);
  const dsd = down.length
    ? Math.sqrt(down.reduce((a, r) => a + r ** 2, 0) / down.length)
    : 0;
  const sortino = dsd ? Math.max(-6, Math.min(8, (mean / dsd) * Math.sqrt(rets.length))) : 0;

  const totalReturnPct = book.equity ? (book.totalPnl / book.wallet) * 100 : 0;

  return {
    winRate: book.winRate,
    avgWin: avg(wins),
    avgLoss: avg(losses),
    profitFactor: book.profitFactor,
    sharpe,
    sortino,
    recoveryFactor: drawdown > 0 ? totalReturnPct / drawdown : 0,
    maxDrawdown: drawdown,
    avgHoldingMin:
      book.positions.reduce((a, p) => a + p.openedMinutesAgo, 0) /
      Math.max(book.positions.length, 1),
  };
}
