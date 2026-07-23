import type { MacroRow } from "@/app/api/macro/route";
import type { NewsItem } from "./use-coin-intel";
import type { Quote } from "./types";

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export type Stance = "Bullish" | "Neutral" | "Bearish";

export type AssetClassRead = {
  key: string;
  th: string;
  en: string;
  changePct: number;
  stance: Stance;
  detail: string;
};

const stanceOf = (v: number, band = 0.35): Stance =>
  v > band ? "Bullish" : v < -band ? "Bearish" : "Neutral";

export const STANCE_TH: Record<Stance, string> = {
  Bullish: "ขาขึ้น",
  Neutral: "เป็นกลาง",
  Bearish: "ขาลง",
};

/** One read per asset class, averaged from its real members. */
export function assetClasses(
  rows: MacroRow[],
  cryptoQuotes: Map<string, Quote>,
): AssetClassRead[] {
  const avg = (group: string) => {
    const items = rows.filter((r) => r.group === group);
    return items.length
      ? items.reduce((a, r) => a + r.changePct, 0) / items.length
      : 0;
  };

  const crypto = [...cryptoQuotes.values()];
  const cryptoAvg = crypto.length
    ? crypto.reduce((a, q) => a + q.changePct, 0) / crypto.length
    : 0;

  const dxy = rows.find((r) => r.symbol === "DX-Y.NYB");
  const tnx = rows.find((r) => r.symbol === "^TNX");
  const vix = rows.find((r) => r.symbol === "^VIX");
  const gold = rows.find((r) => r.symbol === "GC=F");
  const oil = rows.find((r) => r.symbol === "CL=F");
  const etf = avg("etf");

  return [
    {
      key: "crypto",
      th: "คริปโต",
      en: "Crypto",
      changePct: cryptoAvg,
      stance: stanceOf(cryptoAvg, 0.6),
      detail: `เฉลี่ย ${crypto.length} เหรียญหลัก`,
    },
    {
      key: "equity",
      th: "หุ้นทั่วโลก",
      en: "Global Equity",
      changePct: avg("index"),
      stance: stanceOf(avg("index")),
      detail: `จาก ${rows.filter((r) => r.group === "index").length} ดัชนี`,
    },
    {
      key: "dollar",
      th: "ดอลลาร์",
      en: "US Dollar",
      changePct: dxy?.changePct ?? 0,
      // A stronger dollar is a headwind for risk assets.
      stance: stanceOf(dxy?.changePct ?? 0, 0.2),
      detail: dxy ? `DXY ${dxy.price.toFixed(2)}` : "ไม่มีข้อมูล",
    },
    {
      key: "gold",
      th: "ทองคำ",
      en: "Gold",
      changePct: gold?.changePct ?? 0,
      stance: stanceOf(gold?.changePct ?? 0, 0.3),
      detail: gold ? `$${gold.price.toFixed(1)}` : "ไม่มีข้อมูล",
    },
    {
      key: "bond",
      th: "พันธบัตร",
      en: "Bonds",
      // Yields up means bond prices down.
      changePct: -(tnx?.changePct ?? 0),
      stance: stanceOf(-(tnx?.changePct ?? 0), 0.5),
      detail: tnx ? `ผลตอบแทน 10 ปี ${tnx.price.toFixed(3)}%` : "ไม่มีข้อมูล",
    },
    {
      key: "oil",
      th: "น้ำมัน",
      en: "Oil",
      changePct: oil?.changePct ?? 0,
      stance: stanceOf(oil?.changePct ?? 0, 0.6),
      detail: oil ? `WTI $${oil.price.toFixed(2)}` : "ไม่มีข้อมูล",
    },
    {
      key: "etf",
      th: "ETF คริปโต",
      en: "Crypto ETF",
      changePct: etf,
      stance: stanceOf(etf, 0.4),
      detail: `จาก ${rows.filter((r) => r.group === "etf").length} กองทุน`,
    },
    {
      key: "vol",
      th: "ความกลัวในตลาดหุ้น",
      en: "Volatility",
      changePct: -(vix?.changePct ?? 0),
      stance: stanceOf(-(vix?.changePct ?? 0), 1.5),
      detail: vix ? `VIX ${vix.price.toFixed(2)}` : "ไม่มีข้อมูล",
    },
  ];
}

export type RegionPulse = {
  key: string;
  th: string;
  en: string;
  changePct: number | null;
  hot: boolean;
};

/** The world map reads its colours from each region's own index. */
export function regionPulse(rows: MacroRow[]): RegionPulse[] {
  const REGIONS: { key: string; th: string; en: string }[] = [
    { key: "us", th: "อเมริกาเหนือ", en: "North America" },
    { key: "eu", th: "ยุโรป", en: "Europe" },
    { key: "uk", th: "สหราชอาณาจักร", en: "United Kingdom" },
    { key: "jp", th: "ญี่ปุ่น", en: "Japan" },
    { key: "hk", th: "ฮ่องกง / จีน", en: "Hong Kong / China" },
    { key: "th", th: "ไทย", en: "Thailand" },
  ];

  return REGIONS.map((r) => {
    const items = rows.filter((x) => x.region === r.key);
    const change = items.length
      ? items.reduce((a, x) => a + x.changePct, 0) / items.length
      : null;
    return { ...r, changePct: change, hot: change !== null && Math.abs(change) > 1.2 };
  });
}

export type CurrencyStrength = { code: string; th: string; score: number };

/**
 * Currency strength. USD comes from DXY; every other pair is scored by how it
 * moved against the dollar, so the ranking is derived rather than asserted.
 */
export function currencyStrength(
  rows: MacroRow[],
  btc: Quote | undefined,
): CurrencyStrength[] {
  const get = (s: string) => rows.find((r) => r.symbol === s)?.changePct ?? 0;

  const usd = get("DX-Y.NYB");
  const list: CurrencyStrength[] = [
    { code: "USD", th: "ดอลลาร์สหรัฐ", score: clamp(50 + usd * 14) },
    { code: "EUR", th: "ยูโร", score: clamp(50 + get("EURUSD=X") * 14) },
    { code: "GBP", th: "ปอนด์", score: clamp(50 + get("GBPUSD=X") * 14) },
    // USD/JPY up means the yen weakened.
    { code: "JPY", th: "เยน", score: clamp(50 - get("JPY=X") * 14) },
    { code: "THB", th: "บาท", score: clamp(50 - get("THB=X") * 14) },
    { code: "XAU", th: "ทองคำ", score: clamp(50 + get("GC=F") * 10) },
    { code: "BTC", th: "บิตคอยน์", score: clamp(50 + (btc?.changePct ?? 0) * 6) },
  ];

  return list.sort((a, b) => b.score - a.score);
}

export type NewsImpact = {
  item: NewsItem;
  impact: "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  durationTh: string;
  affected: string[];
  direction: Stance;
  reasonTh: string;
};

const HIGH_WORDS =
  /\b(fed|fomc|cpi|inflation|rate|sec|etf|approval|hack|ban|war|emergency|default|halving)\b/i;
const MED_WORDS = /\b(gdp|jobs|payroll|earnings|regulation|lawsuit|upgrade|listing|partnership)\b/i;

/**
 * Impact analysis. The classifier is keyword-based — stated plainly rather
 * than dressed up as a language model — but the direction is cross-checked
 * against how the market is actually moving right now.
 */
export function analyseNews(
  items: NewsItem[],
  cryptoBias: number,
  equityBias: number,
): NewsImpact[] {
  return items.slice(0, 8).map((item) => {
    const high = HIGH_WORDS.test(item.title);
    const med = MED_WORDS.test(item.title);
    const impact: NewsImpact["impact"] = high ? "HIGH" : med ? "MEDIUM" : "LOW";

    const affected: string[] = [];
    if (/\b(btc|bitcoin|etf)\b/i.test(item.title)) affected.push("BTC");
    if (/\b(eth|ethereum)\b/i.test(item.title)) affected.push("ETH");
    if (/\b(fed|cpi|inflation|rate|dollar|treasury)\b/i.test(item.title)) {
      affected.push("USD", "NASDAQ");
    }
    if (/\b(gold|oil|commodity)\b/i.test(item.title)) affected.push("GOLD");
    if (affected.length === 0) affected.push("ตลาดรวม");

    const direction: Stance =
      item.sentiment === "บวก" ? "Bullish" : item.sentiment === "ลบ" ? "Bearish" : "Neutral";

    // Confidence rises when the headline's tone agrees with live price action.
    const marketBias = affected.includes("NASDAQ") ? equityBias : cryptoBias;
    const agrees =
      (direction === "Bullish" && marketBias > 0) ||
      (direction === "Bearish" && marketBias < 0);

    return {
      item,
      impact,
      confidence: Math.round(
        clamp((high ? 68 : med ? 56 : 44) + (agrees ? 16 : -8) + Math.abs(marketBias) * 2),
      ),
      durationTh: high ? "2-3 วัน" : med ? "ภายในวัน" : "ไม่กี่ชั่วโมง",
      affected,
      direction,
      reasonTh: agrees
        ? `ทิศทางข่าวสอดคล้องกับการเคลื่อนไหวของตลาดตอนนี้ (${marketBias >= 0 ? "+" : ""}${marketBias.toFixed(2)}%)`
        : `ทิศทางข่าวยังสวนกับราคาที่เคลื่อนไหวจริง (${marketBias >= 0 ? "+" : ""}${marketBias.toFixed(2)}%) จึงลดความมั่นใจลง`,
    };
  });
}

export type RadarSignal = {
  key: string;
  th: string;
  level: "Early Watch" | "Developing" | "Confirmed" | "Market Reaction";
  levelTh: string;
  detail: string;
  score: number;
};

/**
 * Global Event Radar. Watches leading indicators rather than waiting for a
 * headline, and grades each one by how far it has progressed.
 */
export function eventRadar(
  rows: MacroRow[],
  stablecoins: { symbol: string; price: number; volume: number }[],
  ctxOiChange: number | null,
  news: NewsImpact[],
  cryptoBias: number,
): RadarSignal[] {
  const get = (s: string) => rows.find((r) => r.symbol === s);
  const tnx = get("^TNX");
  const dxy = get("DX-Y.NYB");
  const vix = get("^VIX");
  const etfAvg =
    rows.filter((r) => r.group === "etf").reduce((a, r) => a + r.changePct, 0) /
    Math.max(rows.filter((r) => r.group === "etf").length, 1);

  const grade = (score: number): RadarSignal["level"] =>
    score >= 80 ? "Market Reaction" : score >= 60 ? "Confirmed" : score >= 35 ? "Developing" : "Early Watch";

  const levelTh: Record<RadarSignal["level"], string> = {
    "Early Watch": "เริ่มมีสัญญาณ",
    Developing: "กำลังก่อตัว",
    Confirmed: "ยืนยันแล้ว",
    "Market Reaction": "ตลาดกำลังตอบสนอง",
  };

  const worstPeg = stablecoins.length
    ? Math.max(...stablecoins.map((s) => Math.abs(s.price - 1)))
    : 0;

  const signals: { key: string; th: string; score: number; detail: string }[] = [
    {
      key: "yield",
      th: "ผลตอบแทนพันธบัตรเคลื่อนไหว",
      score: clamp(Math.abs(tnx?.changePct ?? 0) * 28),
      detail: tnx
        ? `US 10Y ${tnx.price.toFixed(3)}% (${tnx.changePct >= 0 ? "+" : ""}${tnx.changePct.toFixed(2)}%)`
        : "ไม่มีข้อมูล",
    },
    {
      key: "dxy",
      th: "ดัชนีดอลลาร์เคลื่อนไหว",
      score: clamp(Math.abs(dxy?.changePct ?? 0) * 90),
      detail: dxy
        ? `DXY ${dxy.price.toFixed(2)} (${dxy.changePct >= 0 ? "+" : ""}${dxy.changePct.toFixed(2)}%)`
        : "ไม่มีข้อมูล",
    },
    {
      key: "stable",
      th: "Stablecoin หลุดตรึง",
      score: clamp(worstPeg * 12000),
      detail: stablecoins.length
        ? `เบี่ยงสูงสุด ${(worstPeg * 100).toFixed(3)}%`
        : "ไม่มีข้อมูล",
    },
    {
      key: "oi",
      th: "สัญญาคงค้างเปลี่ยนแปลง",
      score: clamp(Math.abs(ctxOiChange ?? 0) * 45),
      detail:
        ctxOiChange === null
          ? "ไม่มีข้อมูล"
          : `OI ${ctxOiChange >= 0 ? "+" : ""}${ctxOiChange.toFixed(2)}% ใน 1 ชม.`,
    },
    {
      key: "etf",
      th: "กระแสเงิน ETF",
      score: clamp(Math.abs(etfAvg) * 34),
      detail: `ราคากองทุน ETF เฉลี่ย ${etfAvg >= 0 ? "+" : ""}${etfAvg.toFixed(2)}%`,
    },
    {
      key: "vix",
      th: "ความกลัวในตลาดหุ้น",
      score: clamp(Math.abs(vix?.changePct ?? 0) * 12 + (vix?.price ?? 0)),
      detail: vix ? `VIX ${vix.price.toFixed(2)}` : "ไม่มีข้อมูล",
    },
    {
      key: "news",
      th: "ข่าวจากหน่วยงานกำกับ",
      score: clamp(news.filter((n) => n.impact === "HIGH").length * 30),
      detail: `ข่าวผลกระทบสูง ${news.filter((n) => n.impact === "HIGH").length} รายการ`,
    },
    {
      key: "price",
      th: "ราคาตอบสนองผิดปกติ",
      score: clamp(Math.abs(cryptoBias) * 16),
      detail: `คริปโตเฉลี่ย ${cryptoBias >= 0 ? "+" : ""}${cryptoBias.toFixed(2)}% ใน 24 ชม.`,
    },
  ];

  return signals
    .map((s) => ({ ...s, level: grade(s.score), levelTh: levelTh[grade(s.score)] }))
    .sort((a, b) => b.score - a.score);
}

export type Scenario = {
  key: string;
  th: string;
  probability: number;
  conditionTh: string;
  actionTh: string;
};

/**
 * Three forward scenarios with probabilities that must sum to 100. The weights
 * come from live breadth, the dollar, volatility and news balance.
 */
export function scenarios(
  cryptoBias: number,
  classes: AssetClassRead[],
  news: NewsImpact[],
  vix: number | null,
): Scenario[] {
  const dollar = classes.find((c) => c.key === "dollar");
  const equity = classes.find((c) => c.key === "equity");

  let bull = 34;
  let bear = 33;

  bull += cryptoBias * 3;
  bear -= cryptoBias * 3;
  if (dollar) {
    bull -= dollar.changePct * 6;
    bear += dollar.changePct * 6;
  }
  if (equity) {
    bull += equity.changePct * 4;
    bear -= equity.changePct * 4;
  }
  const badNews = news.filter((n) => n.direction === "Bearish" && n.impact !== "LOW").length;
  bear += badNews * 3;
  bull -= badNews * 2;
  if (vix !== null && vix > 25) {
    bear += 6;
    bull -= 4;
  }

  bull = Math.max(5, bull);
  bear = Math.max(5, bear);
  const neutral = Math.max(5, 100 - bull - bear);
  const total = bull + bear + neutral;

  return [
    {
      key: "bull",
      th: "ขาขึ้นต่อ",
      probability: (bull / total) * 100,
      conditionTh: "ดอลลาร์อ่อนลง · ETF ยังมีแรงซื้อ · ผลตอบแทนพันธบัตรทรงตัว",
      actionTh: "ทยอยสะสมตามแนวโน้ม จำกัดขนาดไม้ตามความผันผวน",
    },
    {
      key: "neutral",
      th: "แกว่งในกรอบ",
      probability: (neutral / total) * 100,
      conditionTh: "ไม่มีข่าวผลกระทบสูง · VIX ทรงตัว · สภาพคล่องคงเดิม",
      actionTh: "เน้นเทรดในกรอบ ลดเลเวอเรจ รอสัญญาณยืนยัน",
    },
    {
      key: "bear",
      th: "ปรับฐานลง",
      probability: (bear / total) * 100,
      conditionTh: "ดอลลาร์แข็ง · ผลตอบแทนพันธบัตรพุ่ง · ข่าวเชิงลบเพิ่ม",
      actionTh: "เพิ่มเงินสด เปิด Hedge และลดสถานะที่สัมพันธ์กันสูง",
    },
  ];
}

export type GlobalRecommendation = {
  asset: string;
  th: string;
  stance: Stance;
  reasonTh: string;
};

export function recommendations(
  classes: AssetClassRead[],
  cryptoQuotes: Map<string, Quote>,
  rows: MacroRow[],
): GlobalRecommendation[] {
  const cls = (k: string) => classes.find((c) => c.key === k);
  const q = (s: string) => cryptoQuotes.get(s);
  const row = (s: string) => rows.find((r) => r.symbol === s);

  const out: GlobalRecommendation[] = [];

  for (const sym of ["BTCUSDT", "ETHUSDT", "SOLUSDT"]) {
    const quote = q(sym);
    if (!quote) continue;
    out.push({
      asset: sym.replace("USDT", ""),
      th: quote.name,
      stance: stanceOf(quote.changePct, 0.8),
      reasonTh: `เคลื่อนไหว ${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}% ใน 24 ชม. · มูลค่าซื้อขาย ${(quote.quoteVolume / 1e9).toFixed(2)}B`,
    });
  }

  const gold = row("GC=F");
  if (gold) {
    out.push({
      asset: "GOLD",
      th: "ทองคำ",
      stance: stanceOf(gold.changePct, 0.3),
      reasonTh: `ราคา $${gold.price.toFixed(1)} · ${gold.changePct >= 0 ? "+" : ""}${gold.changePct.toFixed(2)}%`,
    });
  }

  const dollar = cls("dollar");
  if (dollar) {
    out.push({
      asset: "USD",
      th: "ดอลลาร์สหรัฐ",
      stance: dollar.stance,
      reasonTh: `${dollar.detail} · ${dollar.changePct >= 0 ? "แข็งค่า" : "อ่อนค่า"} ${Math.abs(dollar.changePct).toFixed(2)}%`,
    });
  }

  const nasdaq = row("^IXIC");
  if (nasdaq) {
    out.push({
      asset: "NASDAQ",
      th: "แนสแด็ก",
      stance: stanceOf(nasdaq.changePct, 0.3),
      reasonTh: `${nasdaq.price.toLocaleString(undefined, { maximumFractionDigits: 0 })} · ${nasdaq.changePct >= 0 ? "+" : ""}${nasdaq.changePct.toFixed(2)}%`,
    });
  }

  return out;
}
