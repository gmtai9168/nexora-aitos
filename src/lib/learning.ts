import { atrPct, ema, rsi } from "./analytics";
import { backtest, type BacktestResult, type StrategyParams } from "./strategy";
import type { Candle } from "./types";

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export type Feature = {
  key: string;
  th: string;
  en: string;
  /** Correlation between the feature and the forward return. */
  correlation: number;
  /** Share of the model's attention, normalised across features. */
  weight: number;
  samples: number;
};

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 20) return 0;
  const ma = a.slice(0, n).reduce((x, y) => x + y, 0) / n;
  const mb = b.slice(0, n).reduce((x, y) => x + y, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  const den = Math.sqrt(da * db);
  return den ? num / den : 0;
}

/**
 * Feature importance, measured rather than declared.
 *
 * For every bar we record each feature's value and the return that actually
 * followed it, then correlate the two. A feature that has stopped predicting
 * anything shows a correlation near zero and loses weight automatically.
 */
export function featureImportance(candles: Candle[], horizon = 12): Feature[] {
  if (candles.length < 120) return [];

  const closes = candles.map((c) => c.close);
  const fast = ema(closes, 12);
  const slow = ema(closes, 34);
  const vols = candles.map((c) => c.volume);

  const rows: { key: string; values: number[] }[] = [
    { key: "emaSlope", values: [] },
    { key: "rsi", values: [] },
    { key: "volumeRatio", values: [] },
    { key: "atr", values: [] },
    { key: "rangePos", values: [] },
    { key: "bodyRatio", values: [] },
  ];
  const forward: number[] = [];

  const start = 40;
  for (let i = start; i < candles.length - horizon; i++) {
    const window = candles.slice(Math.max(0, i - 30), i + 1);
    const avgVol = vols.slice(Math.max(0, i - 30), i + 1).reduce((a, b) => a + b, 0) / window.length;
    const hi = Math.max(...window.map((c) => c.high));
    const lo = Math.min(...window.map((c) => c.low));
    const c = candles[i];
    const range = c.high - c.low || 1;

    rows[0].values.push(slow[i] ? ((fast[i] - slow[i]) / slow[i]) * 100 : 0);
    rows[1].values.push(rsi(closes.slice(0, i + 1), 14) - 50);
    rows[2].values.push(avgVol ? c.volume / avgVol : 1);
    rows[3].values.push(atrPct(candles.slice(0, i + 1), 14));
    rows[4].values.push(hi > lo ? ((c.close - lo) / (hi - lo)) * 100 : 50);
    rows[5].values.push(((c.close - c.open) / range) * 100);

    forward.push(((candles[i + horizon].close - c.close) / c.close) * 100);
  }

  const meta: Record<string, [string, string]> = {
    emaSlope: ["ความชันของ EMA", "EMA Slope"],
    rsi: ["RSI", "RSI"],
    volumeRatio: ["อัตราส่วนวอลุ่ม", "Volume Ratio"],
    atr: ["ความผันผวน ATR", "ATR"],
    rangePos: ["ตำแหน่งในกรอบ", "Range Position"],
    bodyRatio: ["สัดส่วนตัวแท่ง", "Candle Body"],
  };

  const raw = rows.map((r) => ({
    key: r.key,
    th: meta[r.key][0],
    en: meta[r.key][1],
    correlation: pearson(r.values, forward),
    samples: r.values.length,
    weight: 0,
  }));

  const total = raw.reduce((a, f) => a + Math.abs(f.correlation), 0) || 1;
  for (const f of raw) f.weight = (Math.abs(f.correlation) / total) * 100;

  return raw.sort((a, b) => b.weight - a.weight);
}

export type LearnedRule = {
  id: string;
  th: string;
  hits: number;
  samples: number;
  winRate: number;
  avgReturn: number;
  verdict: "จำไว้ใช้" | "ระวัง" | "ข้อมูลไม่พอ";
};

/**
 * AI Memory — conditional statistics mined from the real series.
 *
 * Each rule asks "when this condition held, what actually happened next?" and
 * keeps the answer. This is the platform's learned knowledge, and every line
 * of it can be recomputed from the candles on demand.
 */
export function minedRules(candles: Candle[], horizon = 12): LearnedRule[] {
  if (candles.length < 150) return [];

  const closes = candles.map((c) => c.close);
  const fast = ema(closes, 12);
  const slow = ema(closes, 34);

  const conditions: { id: string; th: string; test: (i: number) => boolean }[] = [
    {
      id: "cross-up",
      th: "เมื่อ EMA12 ตัดขึ้นเหนือ EMA34",
      test: (i) => fast[i - 1] <= slow[i - 1] && fast[i] > slow[i],
    },
    {
      id: "cross-down",
      th: "เมื่อ EMA12 ตัดลงใต้ EMA34",
      test: (i) => fast[i - 1] >= slow[i - 1] && fast[i] < slow[i],
    },
    {
      id: "oversold",
      th: "เมื่อ RSI ต่ำกว่า 30 (ขายมากเกินไป)",
      test: (i) => rsi(closes.slice(0, i + 1), 14) < 30,
    },
    {
      id: "overbought",
      th: "เมื่อ RSI สูงกว่า 70 (ซื้อมากเกินไป)",
      test: (i) => rsi(closes.slice(0, i + 1), 14) > 70,
    },
    {
      id: "volume-spike",
      th: "เมื่อวอลุ่มพุ่งเกิน 2 เท่าของค่าเฉลี่ย",
      test: (i) => {
        const avg =
          candles.slice(Math.max(0, i - 30), i).reduce((a, c) => a + c.volume, 0) / 30;
        return avg > 0 && candles[i].volume > avg * 2;
      },
    },
    {
      id: "high-vol",
      th: "เมื่อความผันผวนสูงผิดปกติ (ATR > 1.5%)",
      test: (i) => atrPct(candles.slice(0, i + 1), 14) > 1.5,
    },
  ];

  return conditions.map((cond) => {
    let hits = 0;
    let wins = 0;
    let sum = 0;

    for (let i = 40; i < candles.length - horizon; i++) {
      if (!cond.test(i)) continue;
      hits++;
      const ret = ((candles[i + horizon].close - candles[i].close) / candles[i].close) * 100;
      sum += ret;
      if (ret > 0) wins++;
    }

    const winRate = hits ? (wins / hits) * 100 : 0;
    const avgReturn = hits ? sum / hits : 0;

    return {
      id: cond.id,
      th: cond.th,
      hits,
      samples: candles.length,
      winRate,
      avgReturn,
      verdict:
        hits < 8
          ? "ข้อมูลไม่พอ"
          : winRate >= 55 || winRate <= 45
            ? "จำไว้ใช้"
            : "ระวัง",
    };
  });
}

export type Drift = {
  key: string;
  th: string;
  en: string;
  value: number;
  threshold: number;
  alert: boolean;
  detail: string;
};

/**
 * Drift detection. Splits the history in half and compares what the model saw
 * while it was fitted against what the market looks like now.
 */
export function driftReport(candles: Candle[], params: StrategyParams): {
  drifts: Drift[];
  recent: BacktestResult;
  older: BacktestResult;
  accuracyDrop: number;
  needsRetrain: boolean;
} {
  const mid = Math.floor(candles.length / 2);
  const older = backtest(candles.slice(0, mid), params);
  const recent = backtest(candles.slice(mid), params);

  const closes = candles.map((c) => c.close);
  const oldVol = atrPct(candles.slice(0, mid), 14);
  const newVol = atrPct(candles.slice(mid), 14);
  const oldMean = closes.slice(0, mid).reduce((a, b) => a + b, 0) / Math.max(mid, 1);
  const newMean =
    closes.slice(mid).reduce((a, b) => a + b, 0) / Math.max(closes.length - mid, 1);

  const oldVolume =
    candles.slice(0, mid).reduce((a, c) => a + c.volume, 0) / Math.max(mid, 1);
  const newVolume =
    candles.slice(mid).reduce((a, c) => a + c.volume, 0) / Math.max(candles.length - mid, 1);

  const accuracyDrop = older.winRate ? older.winRate - recent.winRate : 0;
  const pfDrop = older.profitFactor ? older.profitFactor - recent.profitFactor : 0;

  const mk = (
    key: string,
    th: string,
    en: string,
    value: number,
    threshold: number,
    detail: string,
  ): Drift => ({ key, th, en, value, threshold, alert: value > threshold, detail });

  const drifts = [
    mk(
      "accuracy",
      "ความแม่นยำเปลี่ยนไป",
      "Accuracy Drift",
      Math.abs(accuracyDrop),
      8,
      `Win Rate ${older.winRate.toFixed(1)}% → ${recent.winRate.toFixed(1)}%`,
    ),
    mk(
      "prediction",
      "คุณภาพการทำนายเปลี่ยน",
      "Prediction Drift",
      Math.abs(pfDrop) * 30,
      30,
      `Profit Factor ${older.profitFactor.toFixed(2)} → ${recent.profitFactor.toFixed(2)}`,
    ),
    mk(
      "data",
      "ลักษณะข้อมูลเปลี่ยน",
      "Data Drift",
      oldMean ? Math.abs((newMean - oldMean) / oldMean) * 100 : 0,
      18,
      `ราคาเฉลี่ยเปลี่ยน ${oldMean ? (((newMean - oldMean) / oldMean) * 100).toFixed(1) : "0"}%`,
    ),
    mk(
      "feature",
      "ฟีเจอร์เปลี่ยนพฤติกรรม",
      "Feature Drift",
      oldVol ? Math.abs((newVol - oldVol) / oldVol) * 100 : 0,
      35,
      `ATR ${oldVol.toFixed(2)}% → ${newVol.toFixed(2)}%`,
    ),
    mk(
      "volume",
      "ปริมาณซื้อขายเปลี่ยน",
      "Volume Drift",
      oldVolume ? Math.abs((newVolume - oldVolume) / oldVolume) * 100 : 0,
      40,
      `วอลุ่มเฉลี่ยเปลี่ยน ${oldVolume ? (((newVolume - oldVolume) / oldVolume) * 100).toFixed(1) : "0"}%`,
    ),
    mk(
      "stability",
      "ความเสถียรของผลลัพธ์",
      "Confidence Stability",
      Math.abs(older.maxDrawdown - recent.maxDrawdown),
      12,
      `Drawdown ${older.maxDrawdown.toFixed(1)}% → ${recent.maxDrawdown.toFixed(1)}%`,
    ),
  ];

  return {
    drifts,
    recent,
    older,
    accuracyDrop,
    needsRetrain: drifts.filter((d) => d.alert).length >= 2 || accuracyDrop > 10,
  };
}

export type ModelVersion = {
  version: string;
  label: string;
  params: StrategyParams;
  result: BacktestResult;
  accuracy: number;
  stage: "production" | "shadow" | "paper" | "archived";
};

/**
 * Version comparison. Each "version" is a real parameter set run through the
 * same backtest on the same candles, so the leaderboard is an experiment
 * rather than a table of claims.
 */
export function modelVersions(candles: Candle[], base: StrategyParams): ModelVersion[] {
  const variants: { version: string; label: string; patch: Partial<StrategyParams> }[] = [
    { version: "v5.1", label: "ตั้งต้น — EMA ล้วน", patch: { emaFast: 21, emaSlow: 55, targetR: 1.6 } },
    { version: "v5.2", label: "เพิ่มตัวกรอง RSI", patch: { emaFast: 12, emaSlow: 34, rsiFilter: 55, targetR: 2 } },
    { version: "v5.3", label: "ปรับ Stop ตาม ATR", patch: { emaFast: 12, emaSlow: 34, stopAtr: 1.6, targetR: 2.2 } },
    { version: "v5.4", label: "ทดลอง — ถือยาวขึ้น", patch: { emaFast: 8, emaSlow: 34, maxHoldBars: 48, targetR: 3 } },
  ];

  const rows = variants.map((v) => {
    const params = { ...base, ...v.patch };
    const result = backtest(candles, params);
    return {
      version: v.version,
      label: v.label,
      params,
      result,
      // "Accuracy" for a trading model is its hit rate.
      accuracy: result.winRate,
      stage: "archived" as ModelVersion["stage"],
    };
  });

  // The strongest by profit factor is the one that would be in production.
  const best = [...rows].sort((a, b) => b.result.profitFactor - a.result.profitFactor)[0];
  const second = [...rows]
    .filter((r) => r.version !== best?.version)
    .sort((a, b) => b.result.profitFactor - a.result.profitFactor)[0];

  return rows.map((r) => ({
    ...r,
    stage:
      r.version === best?.version
        ? "production"
        : r.version === second?.version
          ? "shadow"
          : r.result.trades.length > 0
            ? "paper"
            : "archived",
  }));
}

export type RewardEvent = {
  symbol: string;
  side: "LONG" | "SHORT";
  returnPct: number;
  reward: number;
  outcome: "บวก" | "ลบ";
};

/** Reinforcement signal built from the trades the backtest actually produced. */
export function rewardStream(result: BacktestResult, symbol: string, limit = 8): RewardEvent[] {
  return result.trades
    .slice(-limit)
    .reverse()
    .map((t) => ({
      symbol,
      side: t.side,
      returnPct: t.pnlPct,
      // Reward is the R-multiple, clipped the way an RL agent would clip it.
      reward: Math.max(-1, Math.min(1, t.r)),
      outcome: t.r > 0 ? "บวก" : "ลบ",
    }));
}

export type ResearchTask = {
  id: string;
  th: string;
  priority: "สูง" | "กลาง" | "ต่ำ";
  reason: string;
};

/**
 * The Chief AI Research Scientist's queue. It can propose work but never ship
 * a model — every item still has to clear the full validation pipeline.
 */
export function researchQueue(
  features: Feature[],
  drift: { drifts: Drift[]; needsRetrain: boolean; accuracyDrop: number },
  rules: LearnedRule[],
  versions: ModelVersion[],
): ResearchTask[] {
  const out: ResearchTask[] = [];

  const weakest = features.at(-1);
  if (weakest && Math.abs(weakest.correlation) < 0.05) {
    out.push({
      id: "drop-feature",
      th: `พิจารณาถอดฟีเจอร์ "${weakest.th}" ออกจากโมเดล`,
      priority: "กลาง",
      reason: `สหสัมพันธ์กับผลตอบแทนล่วงหน้าเหลือ ${weakest.correlation.toFixed(3)} — แทบไม่มีพลังทำนาย`,
    });
  }

  const strongest = features[0];
  if (strongest && Math.abs(strongest.correlation) > 0.1) {
    out.push({
      id: "boost-feature",
      th: `เพิ่มน้ำหนักให้ฟีเจอร์ "${strongest.th}"`,
      priority: "สูง",
      reason: `เป็นฟีเจอร์ที่สัมพันธ์กับผลตอบแทนมากที่สุด (${strongest.correlation.toFixed(3)})`,
    });
  }

  if (drift.needsRetrain) {
    out.push({
      id: "retrain",
      th: "เสนอฝึกโมเดลใหม่ (Auto Retraining)",
      priority: "สูง",
      reason: `พบ ${drift.drifts.filter((d) => d.alert).length} มิติที่เบี่ยงเกินเกณฑ์ · ความแม่นยำลด ${drift.accuracyDrop.toFixed(1)}%`,
    });
  }

  const useful = rules.filter((r) => r.verdict === "จำไว้ใช้");
  if (useful.length > 0) {
    const top = [...useful].sort((a, b) => Math.abs(b.winRate - 50) - Math.abs(a.winRate - 50))[0];
    out.push({
      id: "new-rule",
      th: "เสนอสร้างกลยุทธ์ใหม่จากรูปแบบที่ค้นพบ",
      priority: "กลาง",
      reason: `${top.th} ให้ผลชนะ ${top.winRate.toFixed(0)}% จาก ${top.hits} ครั้ง`,
    });
  }

  const prod = versions.find((v) => v.stage === "production");
  const shadow = versions.find((v) => v.stage === "shadow");
  if (prod && shadow && shadow.result.profitFactor > prod.result.profitFactor) {
    out.push({
      id: "promote",
      th: `เสนอเลื่อน ${shadow.version} ขึ้นแทน ${prod.version}`,
      priority: "สูง",
      reason: `Profit Factor ${shadow.result.profitFactor.toFixed(2)} สูงกว่าตัวปัจจุบัน ${prod.result.profitFactor.toFixed(2)}`,
    });
  }

  if (out.length === 0) {
    out.push({
      id: "monitor",
      th: "ยังไม่มีงานวิจัยเร่งด่วน",
      priority: "ต่ำ",
      reason: "ทุกฟีเจอร์และโมเดลยังอยู่ในเกณฑ์ที่ตั้งไว้",
    });
  }

  return out;
}

export type DatasetInfo = {
  key: string;
  th: string;
  source: string;
  records: number | null;
  freshnessSec: number | null;
  quality: number;
  online: boolean;
};

/** Real inventory of what this app actually consumes. */
export function datasets(input: {
  candles: number;
  bookLevels: number;
  tradeCount: number;
  hasFutures: boolean;
  hasOnChain: boolean;
  newsCount: number;
  venuesOnline: number;
  venuesTotal: number;
  lastUpdate: number;
  now: number;
}): DatasetInfo[] {
  const age = input.lastUpdate ? Math.round((input.now - input.lastUpdate) / 1000) : null;

  return [
    {
      key: "candles",
      th: "แท่งเทียนย้อนหลัง",
      source: "Binance klines",
      records: input.candles,
      freshnessSec: age,
      quality: clamp(input.candles / 20),
      online: input.candles > 0,
    },
    {
      key: "book",
      th: "สมุดคำสั่ง",
      source: "Binance depth",
      records: input.bookLevels,
      freshnessSec: age,
      quality: clamp(input.bookLevels * 4),
      online: input.bookLevels > 0,
    },
    {
      key: "trades",
      th: "รายการซื้อขาย (Tape)",
      source: "Binance aggTrades",
      records: input.tradeCount,
      freshnessSec: age,
      quality: clamp(input.tradeCount * 5),
      online: input.tradeCount > 0,
    },
    {
      key: "futures",
      th: "Funding · OI · Long/Short",
      source: "Binance Futures",
      records: input.hasFutures ? 3 : 0,
      freshnessSec: age,
      quality: input.hasFutures ? 95 : 0,
      online: input.hasFutures,
    },
    {
      key: "onchain",
      th: "ข้อมูลออนเชน",
      source: "blockchain.info · mempool.space",
      records: input.hasOnChain ? 8 : 0,
      freshnessSec: age,
      quality: input.hasOnChain ? 90 : 0,
      online: input.hasOnChain,
    },
    {
      key: "news",
      th: "ข่าวและอารมณ์ตลาด",
      source: "Yahoo Finance · Fear & Greed",
      records: input.newsCount,
      freshnessSec: age,
      quality: clamp(input.newsCount * 9),
      online: input.newsCount > 0,
    },
    {
      key: "venues",
      th: "ราคาข้าม Exchange",
      source: "Binance · Bybit · OKX · Bitget · Kraken",
      records: input.venuesOnline,
      freshnessSec: age,
      quality: input.venuesTotal
        ? (input.venuesOnline / input.venuesTotal) * 100
        : 0,
      online: input.venuesOnline > 0,
    },
  ];
}
