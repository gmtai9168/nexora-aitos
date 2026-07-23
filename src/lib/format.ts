/** Number of decimals that reads naturally for a given price magnitude. */
export function priceDigits(price: number): number {
  const p = Math.abs(price);
  if (p >= 1000) return 2;
  if (p >= 100) return 2;
  if (p >= 1) return 3;
  if (p >= 0.01) return 4;
  if (p >= 0.0001) return 6;
  return 8;
}

export function fmtPrice(n: number | null | undefined, digits?: number): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const d = digits ?? priceDigits(n);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Always signed — the dashboard shows deltas everywhere. */
export function fmtSigned(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + fmtNum(n, digits);
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(digits) + "%";
}

export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

export function toneClass(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n === 0)
    return "text-muted";
  return n > 0 ? "text-up" : "text-down";
}

/** HH:MM:SS in Bangkok time — the header clock and every log timestamp. */
export function bkkTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

export function bkkShort(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}
