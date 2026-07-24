import { latestSignal } from "../backtest-lab";
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
 * One autonomous decision cycle on the testnet.
 *
 * Deliberately stateless: every run reads the live account and positions, so
 * there is no drifting in-memory state to trust. Exits are handled first (a
 * position at its take-profit or stop is closed), then entries are considered
 * for symbols not already held, up to the position cap. Every entry passes the
 * same risk gate a manual order does. With `dryRun`, decisions are computed but
 * no order is sent — the way to prove the logic before it touches the book.
 */
export async function runCycle(rawConfig: AiTraderConfig, dryRun: boolean): Promise<CycleReport> {
  const config = sanitizeConfig(rawConfig);
  const ranAt = Date.now();
  const decisions: Decision[] = [];

  const acc = await account();
  if (!acc.ok) {
    return { ok: false, ranAt, dryRun, balance: null, openPositions: 0, opened: 0, closed: 0, decisions, message: `อ่านบัญชีไม่ได้: ${acc.message}` };
  }
  const balance = Number(acc.data.availableBalance);

  const posRes = await positions();
  const open: PositionRaw[] = posRes.ok ? posRes.data.filter((p) => Number(p.positionAmt) !== 0) : [];
  const held = new Map(open.map((p) => [p.symbol, p]));

  let opened = 0;
  let closed = 0;

  // 1) Exits — close anything that reached take-profit or stop-loss on margin.
  for (const p of open) {
    const amt = Number(p.positionAmt);
    const notional = Math.abs(amt) * Number(p.markPrice);
    const margin = notional / Math.max(Number(p.leverage), 1);
    const pnlPct = margin ? (Number(p.unRealizedProfit) / margin) * 100 : 0;
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
      closed++;
      held.delete(p.symbol);
      decisions.push({
        symbol: p.symbol,
        action: hitTp ? "closed_tp" : "closed_sl",
        side,
        detail: `${side} · กำไร/ขาดทุนบนมาร์จิน ${pnlPct.toFixed(1)}%${dryRun ? " (จำลอง)" : ""}`,
        pnlPct,
      });
    } else {
      decisions.push({ symbol: p.symbol, action: "hold", side, detail: `ถือต่อ · ${pnlPct.toFixed(1)}% บนมาร์จิน`, pnlPct });
    }
  }

  // 2) Entries — for symbols not held, while under the position cap.
  for (const symbol of config.symbols) {
    if (held.has(symbol)) {
      decisions.push({ symbol, action: "already_open", detail: "มีสถานะอยู่แล้ว ข้ามการเปิดใหม่" });
      continue;
    }
    if (held.size >= config.maxPositions) {
      decisions.push({ symbol, action: "max_positions", detail: `ครบเพดาน ${config.maxPositions} สถานะแล้ว` });
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

    const price = kl.data.at(-1)!.close;
    const marginToUse = balance * (config.riskPct / 100);
    const rawQty = (marginToUse * config.leverage) / price;
    const qty = await roundQuantity(symbol, rawQty);
    if (!qty) {
      decisions.push({ symbol, action: "error", side: signal.dir, detail: "ขนาดเล็กกว่าขั้นต่ำของกระดาน — เพิ่ม risk% หรือ leverage" });
      continue;
    }

    const intent: OrderIntent = {
      symbol,
      side: signal.dir === "LONG" ? "BUY" : "SELL",
      type: "MARKET",
      quantity: qty,
      leverage: config.leverage,
      reduceOnly: false,
    };
    const verdict = riskCheck(intent, price);
    if (!verdict.ok) {
      const failed = verdict.checks.filter((c) => !c.pass).map((c) => c.label).join(", ");
      decisions.push({ symbol, action: "blocked_risk", side: signal.dir, confidence: signal.confidence, detail: `Risk Engine: ${failed}` });
      continue;
    }

    if (!dryRun) {
      const lev = await setLeverage(symbol, config.leverage);
      if (!lev.ok) {
        decisions.push({ symbol, action: "error", side: signal.dir, detail: `ตั้ง Leverage ไม่ได้: ${lev.message}` });
        continue;
      }
      const res = await placeOrder(intent);
      if (!res.ok) {
        decisions.push({ symbol, action: "error", side: signal.dir, detail: `กระดานปฏิเสธ: ${res.message}` });
        continue;
      }
      opened++;
      held.set(symbol, {} as PositionRaw);
      decisions.push({
        symbol,
        action: "opened",
        side: signal.dir,
        confidence: signal.confidence,
        detail: `${signal.reason} · ${signal.regime}`,
        price,
        qty,
        orderId: res.data.orderId,
      });
    } else {
      opened++;
      held.set(symbol, {} as PositionRaw);
      decisions.push({
        symbol,
        action: "opened",
        side: signal.dir,
        confidence: signal.confidence,
        detail: `(จำลอง) ${signal.reason} · มูลค่า ${verdict.notionalUsd.toFixed(0)} USDT`,
        price,
        qty,
      });
    }
  }

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
      ? `จำลองสำเร็จ — จะเปิด ${opened} · ปิด ${closed} (ไม่ได้ส่งคำสั่งจริง)`
      : `รอบทำงานเสร็จ — เปิด ${opened} · ปิด ${closed} สถานะ`,
  };
}
