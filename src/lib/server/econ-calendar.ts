/**
 * #1 Economic calendar — a scheduled-event lockout.
 *
 * The news layer reacts to headlines *after* they break. This one is smarter
 * for events that are *known in advance*: it keeps the trader out of the
 * minutes around a high-impact catalyst instead of walking into the volatility.
 *
 * Two honest sources, no paid dependency required:
 *   • DETERMINISTIC (always on, free): crypto options/futures expiry. BTC/ETH
 *     options settle every Friday 08:00 UTC; the last Friday of a month is the
 *     monthly expiry and the last Friday of Mar/Jun/Sep/Dec the quarterly — both
 *     reliably move the market. These are computed exactly, never guessed.
 *   • KEYED (optional): if FINNHUB_TOKEN is set, real macro prints (CPI, FOMC,
 *     NFP) are pulled from Finnhub's free economic calendar. Without the key we
 *     simply don't claim to know those dates — we never hardcode dates we're
 *     unsure of.
 */

export type MacroEvent = {
  at: number;
  label: string;
  kind: "expiry_quarterly" | "expiry_monthly" | "expiry_weekly" | "fomc" | "cpi" | "nfp" | "macro";
  impact: "high" | "medium";
};

/** Lockout runs from LOCK_BEFORE_MIN before to LOCK_AFTER_MIN after a high event. */
const LOCK_BEFORE_MIN = 30;
const LOCK_AFTER_MIN = 15;
const HORIZON_DAYS = 8;

const MIN = 60_000;

/* ------------------------------------------------------------------ *
 * Deterministic: options/futures expiry (Friday 08:00 UTC)
 * ------------------------------------------------------------------ */

function isLastFridayOfMonth(ts: number): boolean {
  const d = new Date(ts);
  const plus7 = new Date(ts + 7 * 24 * MIN * 60);
  return plus7.getUTCMonth() !== d.getUTCMonth();
}

function expiriesAhead(now: number): MacroEvent[] {
  const out: MacroEvent[] = [];
  const start = new Date(now);
  for (let i = 0; i <= HORIZON_DAYS; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i, 8, 0, 0));
    if (d.getUTCDay() !== 5) continue; // Friday only
    const at = d.getTime();
    if (at < now - LOCK_AFTER_MIN * MIN) continue;
    const monthly = isLastFridayOfMonth(at);
    const quarterly = monthly && [2, 5, 8, 11].includes(d.getUTCMonth());
    if (quarterly) out.push({ at, label: "ออปชั่นหมดอายุรายไตรมาส (BTC/ETH)", kind: "expiry_quarterly", impact: "high" });
    else if (monthly) out.push({ at, label: "ออปชั่นหมดอายุรายเดือน (BTC/ETH)", kind: "expiry_monthly", impact: "high" });
    else out.push({ at, label: "ออปชั่นหมดอายุรายสัปดาห์", kind: "expiry_weekly", impact: "medium" });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Optional keyed macro (Finnhub free tier)
 * ------------------------------------------------------------------ */

const HIGH_MACRO = /\b(CPI|FOMC|Fed Interest Rate|Interest Rate Decision|Non-?Farm|Nonfarm Payrolls|PCE|PPI|GDP)\b/i;

async function keyedMacro(now: number): Promise<MacroEvent[]> {
  const token = process.env.FINNHUB_TOKEN;
  if (!token) return [];
  try {
    const from = new Date(now).toISOString().slice(0, 10);
    const to = new Date(now + HORIZON_DAYS * 24 * MIN * 60).toISOString().slice(0, 10);
    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${token}`,
      { cache: "no-store", signal: AbortSignal.timeout(7000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      economicCalendar?: { event?: string; time?: string; impact?: string; country?: string }[];
    };
    return (data.economicCalendar ?? [])
      .filter((e) => e.country === "US" && e.impact === "high" && e.event && HIGH_MACRO.test(e.event) && e.time)
      .map((e) => {
        const at = Date.parse(e.time!.replace(" ", "T") + "Z");
        const kind: MacroEvent["kind"] = /CPI/i.test(e.event!) ? "cpi" : /FOMC|Rate/i.test(e.event!) ? "fomc" : /Payroll|Nonfarm/i.test(e.event!) ? "nfp" : "macro";
        return { at, label: e.event!, kind, impact: "high" as const };
      })
      .filter((e) => Number.isFinite(e.at));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Public
 * ------------------------------------------------------------------ */

export type MacroWindow = {
  lockout: boolean;
  /** The high-impact event we're inside the window of, when locked out. */
  event: MacroEvent | null;
  /** The next high-impact event ahead, for display. */
  next: MacroEvent | null;
};

export async function upcomingMacro(now: number): Promise<MacroWindow> {
  const events = [...expiriesAhead(now), ...(await keyedMacro(now))].sort((a, b) => a.at - b.at);
  const high = events.filter((e) => e.impact === "high");

  const active = high.find((e) => now >= e.at - LOCK_BEFORE_MIN * MIN && now <= e.at + LOCK_AFTER_MIN * MIN) ?? null;
  const next = high.find((e) => e.at > now) ?? null;

  return { lockout: active !== null, event: active, next };
}

/** Minutes until an event, signed (negative = already passed). */
export function minutesTo(event: MacroEvent, now: number): number {
  return Math.round((event.at - now) / MIN);
}
