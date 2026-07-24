import { latestSignal } from "../backtest-lab";
import {
  bucketKey,
  EMPTY_MEMORY,
  learningScore,
  recordOutcome,
  shouldAvoid,
  type AiMemory,
  type OpenContext,
} from "../ai-memory";
import { riskCheck, type OrderIntent } from "../testnet";
import {
  sanitizeConfig,
  type AiTraderConfig,
  type CycleReport,
  type Decision,
} from "../ai-trader";
import {
  account,
  klines,
  placeOrder,
  positions,
  roundQuantity,
  setLeverage,
  type PositionRaw,
} from "./binance-testnet";

/**
 * One autonomous decision cycle on the testnet, now with a memory.
 *
 * Exits come first: a position at its take-profit or stop is closed, and the
 * result is written into the learning memory against the bucket it was opened
 * in. Entries then consider symbols not held — but the memory gates them: a
 * bucket that has lost repeatedly is skipped, and the remaining candidates are
 * ranked by their track record so scarce position slots go to what has worked.
 * With `dryRun`, decisions are computed and the memory is read but never
 * mutated and no order is sent.
 */
export async function runCycle(
  rawConfig: AiTraderConfig,
  dryRun: boolean,
  memoryIn: AiMemory,
): Promise<CycleReport> {
  const config = sanitizeConfig(rawConfig);
  const ranAt = Date.now();
  const decisions: Decision[] = [];
  let memory: AiMemory = { ...EMPTY_MEMORY, ...memoryIn, stats: { ...memoryIn.stats }, open: { ...memoryIn.open } };

  const acc = await account();
  if (!acc.ok) {
    return { ok: false, ranAt, dryRun, balance: null, openPositions: 0, opened: 0, closed: 0, decisions, message: `อ่านบัญชีไม่ได้: ${acc.message}`, memory };
  }
  const balance = Number(acc.data.availableBalance);

  const posRes = await positions();
  const open: PositionRaw[] = posRes.ok ? posRes.data.filter((p) => Number(p.positionAmt) !== 0) : [];
  const held = new Map(open.map((p) => [p.symbol, p]));

  let opened = 0;
  let closed = 0;

  const commitClose = (symbol: string, pnl: number) => {
    if (dryRun) return;
    const ctx = memory.open[symbol];
    if (ctx) {
      memory = recordOutcome(memory, bucketKey(ctx.strategy, symbol, ctx.regime), pnl, ranAt);
      const nextOpen = { ...memory.open };
      delete nextOpen[symbol];
      memory = { ...memory, open: nextOpen };
    }
  };

  // 1) Exits — close anything past take-profit or stop, and learn from it.
  for (const p of open) {
    const amt = Number(p.positionAmt);
    const notional = Math.abs(amt) * Number(p.markPrice);
    const margin = notional / Math.max(Number(p.leverage), 1);
    const pnl = Number(p.unRealizedProfit);
    const pnlPct = margin ? (pnl / margin) * 100 : 0;
    const side = amt > 0 ? "LONG" : "SHORT";

    const hitTp = pnlPct >= config.takeProfitPct;
    const hitSl = pnlPct <= -config.stopLossPct;

    if (hitTp || hitSl) {
      if (!dryRun) {
        const qty = await roundQuantity(p.symbol, Math.abs(amt));
        if (qty) {
          const res = await placeOrder({
            symbol: p.symbol,
            side: amt > 0 ? "SELL" : "BUY",
            type: "MARKET",
            quantity: qty,
            reduceOnly: true,
          });
          if (!res.ok) {
            decisions.push({ symbol: p.symbol, action: "error", side, detail: `ปิดไม่สำเร็จ: ${res.message}`, pnlPct });
            continue;
          }
        }
      }
      commitClose(p.symbol, pnl);
      closed++;
      held.delete(p.symbol);
      decisions.push({
        symbol: p.symbol,
        action: hitTp ? "closed_tp" : "closed_sl",
        side,
        detail: `${side} · P&L ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} (${pnlPct.toFixed(1)}% บนมาร์จิน)${dryRun ? " (จำลอง)" : " · บันทึกลงความจำแล้ว"}`,
        pnlPct,
      });
    } else {
      // Keep the open context's last-seen P&L fresh for external-close handling.
      if (!dryRun && memory.open[p.symbol]) {
        memory = { ...memory, open: { ...memory.open, [p.symbol]: { ...memory.open[p.symbol], lastPnl: pnl } } };
      }
      decisions.push({ symbol: p.symbol, action: "hold", side, detail: `ถือต่อ · ${pnlPct.toFixed(1)}% บนมาร์จิน`, pnlPct });
    }
  }

  // Reconcile: a tracked position that vanished (closed elsewhere) is learned
  // from with its last-seen P&L, so the memory never leaks stale contexts.
  if (!dryRun) {
    for (const symbol of Object.keys(memory.open)) {
      if (!held.has(symbol)) {
        const ctx = memory.open[symbol];
        memory = recordOutcome(memory, bucketKey(ctx.strategy, symbol, ctx.regime), ctx.lastPnl, ranAt);
        const nextOpen = { ...memory.open };
        delete nextOpen[symbol];
        memory = { ...memory, open: nextOpen };
        closed++;
        decisions.push({ symbol, action: ctx.lastPnl >= 0 ? "closed_tp" : "closed_sl", detail: `ปิดจากภายนอก · บันทึกผล ${ctx.lastPnl.toFixed(2)} ลงความจำ`, pnlPct: 0 });
      }
    }
  }

  // 2) Entries — gather candidates, let the memory gate and rank them.
  type Candidate = { symbol: string; dir: "LONG" | "SHORT"; confidence: number; reason: string; regime: string; price: number; score: number };
  const candidates: Candidate[] = [];

  for (const symbol of config.symbols) {
    if (held.has(symbol)) {
      decisions.push({ symbol, action: "already_open", detail: "มีสถานะอยู่แล้ว ข้ามการเปิดใหม่" });
      continue;
    }

    const kl = await klines(symbol, config.interval, 300);
    if (!kl.ok || kl.data.length < 150) {
      decisions.push({ symbol, action: "error", detail: "ข้อมูลแท่งเทียนไม่พอ" });
      continue;
    }
    const signal = latestSignal(kl.data, config.strategy);
    if (!signal) {
      decisions.push({ symbol, action: "no_signal", detail: "โมเดลไม่ให้สัญญาณที่แท่งล่าสุด" });
      continue;
    }
    if (signal.confidence < config.minConfidence) {
      decisions.push({ symbol, action: "low_confidence", side: signal.dir, confidence: signal.confidence, detail: `ความมั่นใจ ${signal.confidence}% < เกณฑ์ ${config.minConfidence}%` });
      continue;
    }

    const key = bucketKey(config.strategy, symbol, signal.regime);
    const stat = memory.stats[key];
    const score = learningScore(stat);

    if (shouldAvoid(stat)) {
      decisions.push({
        symbol,
        action: "learned_avoid",
        side: signal.dir,
        confidence: signal.confidence,
        learnScore: score,
        detail: `เคยเทรด ${stat!.trades} ครั้งในสภาวะ "${signal.regime}" ชนะ ${((stat!.wins / stat!.trades) * 100).toFixed(0)}% รวมขาดทุน — AI เลือกเลี่ยง`,
      });
      continue;
    }

    candidates.push({ symbol, dir: signal.dir, confidence: signal.confidence, reason: signal.reason, regime: signal.regime, price: kl.data.at(-1)!.close, score });
  }

  // Best track record first, then highest confidence — scarce slots go to what has worked.
  candidates.sort((a, b) => b.score - a.score || b.confidence - a.confidence);

  for (const c of candidates) {
    if (held.size >= config.maxPositions) {
      decisions.push({ symbol: c.symbol, action: "max_positions", side: c.dir, confidence: c.confidence, learnScore: c.score, detail: `ครบเพดาน ${config.maxPositions} สถานะ — คิวไว้ (คะแนนบทเรียน ${c.score.toFixed(0)})` });
      continue;
    }

    const marginToUse = balance * (config.riskPct / 100);
    const rawQty = (marginToUse * config.leverage) / c.price;
    const qty = await roundQuantity(c.symbol, rawQty);
    if (!qty) {
      decisions.push({ symbol: c.symbol, action: "error", side: c.dir, detail: "ขนาดเล็กกว่าขั้นต่ำของกระดาน" });
      continue;
    }

    const intent: OrderIntent = { symbol: c.symbol, side: c.dir === "LONG" ? "BUY" : "SELL", type: "MARKET", quantity: qty, leverage: config.leverage, reduceOnly: false };
    const verdict = riskCheck(intent, c.price);
    if (!verdict.ok) {
      const failed = verdict.checks.filter((x) => !x.pass).map((x) => x.label).join(", ");
      decisions.push({ symbol: c.symbol, action: "blocked_risk", side: c.dir, confidence: c.confidence, detail: `Risk Engine: ${failed}` });
      continue;
    }

    const learnNote = c.score > 15 ? ` · บทเรียนดี (+${c.score.toFixed(0)})` : c.score < -15 ? ` · บทเรียนเสี่ยง (${c.score.toFixed(0)})` : "";

    if (!dryRun) {
      const lev = await setLeverage(c.symbol, config.leverage);
      if (!lev.ok) {
        decisions.push({ symbol: c.symbol, action: "error", side: c.dir, detail: `ตั้ง Leverage ไม่ได้: ${lev.message}` });
        continue;
      }
      const res = await placeOrder(intent);
      if (!res.ok) {
        decisions.push({ symbol: c.symbol, action: "error", side: c.dir, detail: `กระดานปฏิเสธ: ${res.message}` });
        continue;
      }
      const ctx: OpenContext = { strategy: config.strategy, regime: c.regime, confidence: c.confidence, entryPrice: c.price, openedAt: ranAt, lastPnl: 0 };
      memory = { ...memory, open: { ...memory.open, [c.symbol]: ctx } };
      opened++;
      held.set(c.symbol, {} as PositionRaw);
      decisions.push({ symbol: c.symbol, action: "opened", side: c.dir, confidence: c.confidence, learnScore: c.score, detail: `${c.reason} · ${c.regime}${learnNote}`, price: c.price, qty, orderId: res.data.orderId });
    } else {
      opened++;
      held.set(c.symbol, {} as PositionRaw);
      decisions.push({ symbol: c.symbol, action: "opened", side: c.dir, confidence: c.confidence, learnScore: c.score, detail: `(จำลอง) ${c.reason}${learnNote} · มูลค่า ${verdict.notionalUsd.toFixed(0)} USDT`, price: c.price, qty });
    }
  }

  memory = { ...memory, updatedAt: ranAt };

  return {
    ok: true,
    ranAt,
    dryRun,
    balance,
    openPositions: held.size,
    opened,
    closed,
    decisions,
    message: dryRun
      ? `จำลองสำเร็จ — จะเปิด ${opened} · ปิด ${closed} (ไม่แตะความจำ)`
      : `รอบทำงานเสร็จ — เปิด ${opened} · ปิด ${closed} · ความจำสะสม ${memory.totalClosed} ไม้`,
    memory,
  };
}
