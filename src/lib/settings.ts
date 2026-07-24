/* ------------------------------------------------------------------ *
 * Settings store — persisted to this browser, with a real audit trail.
 *
 * Everything here is a genuine preference that survives reload. What it
 * cannot be is a server-side account or a live exchange connection: the
 * platform holds no API keys and submits no orders, so the Exchange and
 * Users sections describe status and intent rather than acting on it.
 * ------------------------------------------------------------------ */

export type RoleId =
  | "personal"
  | "professional"
  | "quant"
  | "fundManager"
  | "riskManager"
  | "sysadmin"
  | "superAdmin";

export const ROLES: { id: RoleId; th: string; en: string }[] = [
  { id: "personal", th: "นักลงทุนรายบุคคล", en: "Personal Trader" },
  { id: "professional", th: "นักเทรดมืออาชีพ", en: "Professional Trader" },
  { id: "quant", th: "นักพัฒนาเชิงปริมาณ", en: "Quant Developer" },
  { id: "fundManager", th: "ผู้จัดการกองทุน", en: "Fund Manager" },
  { id: "riskManager", th: "ผู้จัดการความเสี่ยง", en: "Risk Manager" },
  { id: "sysadmin", th: "ผู้ดูแลระบบ", en: "System Admin" },
  { id: "superAdmin", th: "ผู้ดูแลสูงสุด", en: "Super Admin" },
];

export type TabId =
  | "account"
  | "security"
  | "exchange"
  | "trading"
  | "risk"
  | "ai"
  | "notifications"
  | "users"
  | "display"
  | "data"
  | "billing"
  | "audit";

export const TABS: { id: TabId; th: string; en: string; roles: RoleId[] | "all" }[] = [
  { id: "account", th: "บัญชีและโปรไฟล์", en: "Account & Profile", roles: "all" },
  { id: "security", th: "ความปลอดภัย", en: "Security", roles: "all" },
  { id: "exchange", th: "Exchange & API", en: "Exchange & API", roles: "all" },
  { id: "trading", th: "ค่าเริ่มต้นการเทรด", en: "Trading Defaults", roles: ["personal", "professional", "fundManager", "superAdmin"] },
  { id: "risk", th: "ความเสี่ยงและเลเวอเรจ", en: "Risk & Leverage", roles: ["riskManager", "fundManager", "professional", "superAdmin"] },
  { id: "ai", th: "AI และระบบอัตโนมัติ", en: "AI & Automation", roles: ["quant", "professional", "fundManager", "superAdmin"] },
  { id: "notifications", th: "การแจ้งเตือน", en: "Notifications", roles: "all" },
  { id: "users", th: "ผู้ใช้และสิทธิ์", en: "Users & Permissions", roles: ["fundManager", "sysadmin", "superAdmin"] },
  { id: "display", th: "การแสดงผลและภาษา", en: "Display & Language", roles: "all" },
  { id: "data", th: "ข้อมูลและเขตเวลา", en: "Data & Time Zone", roles: ["quant", "sysadmin", "superAdmin"] },
  { id: "billing", th: "แพ็กเกจและการชำระเงิน", en: "Billing & Subscription", roles: ["fundManager", "superAdmin"] },
  { id: "audit", th: "บันทึกการตรวจสอบ", en: "Audit & Logs", roles: ["riskManager", "sysadmin", "superAdmin"] },
];

export function tabsForRole(role: RoleId): typeof TABS {
  return TABS.filter((t) => t.roles === "all" || t.roles.includes(role));
}

/* ------------------------------------------------------------------ *
 * The settings shape
 * ------------------------------------------------------------------ */

export type Settings = {
  role: RoleId;

  account: {
    firstName: string;
    lastName: string;
    displayName: string;
    email: string;
    phone: string;
    country: string;
    accountType: string;
    kyc: "verified" | "pending" | "none";
    tier: string;
  };

  security: {
    twoFactor: boolean;
    passkey: boolean;
    biometric: boolean;
    ipWhitelist: boolean;
    withdrawalLock: boolean;
    antiPhishingCode: string;
    confirmSensitive: boolean;
    sessionTimeoutMin: number;
  };

  trading: {
    market: "crypto" | "stock";
    venue: string;
    contract: "spot" | "futures";
    marginMode: "cross" | "isolated";
    direction: "long" | "short" | "both";
    orderType: "market" | "limit";
    timeInForce: "GTC" | "IOC" | "FOK" | "PO";
    positionPct: number;
    leverage: number;
    takeProfitPct: number;
    stopLossPct: number;
    trailing: boolean;
    reduceOnly: boolean;
    postOnly: boolean;
    slippagePct: number;
  };

  risk: {
    maxLeverage: number;
    riskPerTradePct: number;
    dailyLossLimitPct: number;
    weeklyLossLimitPct: number;
    maxDrawdownPct: number;
    marginUsageLimitPct: number;
    maxOpenPositions: number;
    perSymbolExposurePct: number;
    perVenueExposurePct: number;
    correlationLimit: number;
    minLiquidationDistancePct: number;
    consecutiveLossLimit: number;
    newsLockoutMin: number;
  };

  ai: {
    mode: "monitor" | "recommend" | "semiAuto" | "fullAuto" | "capitalPreservation" | "pause";
    minConfidence: number;
    minConsensus: number;
    minRiskReward: number;
    autoRebalance: boolean;
    autoHedge: boolean;
    dynamicLeverage: boolean;
    autoReduce: boolean;
    modelVersionLock: boolean;
    tradingHours: { from: string; to: string; restricted: boolean };
  };

  notifications: {
    channels: Record<string, boolean>;
    events: Record<string, boolean>;
    digest: "instant" | "hourly" | "daily";
  };

  display: {
    language: "th" | "en";
    theme: "dark" | "light";
    accent: string;
    fontScale: "compact" | "normal" | "large";
    numberFormat: "thousands" | "compact";
    referenceCurrency: "USDT" | "THB" | "USD";
    timezone: string;
    dateFormat: "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";
    time24h: boolean;
    layout: "compact" | "comfortable";
    hideBalances: boolean;
  };

  data: {
    marketProvider: string;
    newsProvider: string;
    onchainProvider: string;
    refreshRateSec: number;
    staleThresholdSec: number;
    priceDeviationPct: number;
    preferredVenue: string;
  };
};

export const DEFAULT_SETTINGS: Settings = {
  role: "superAdmin",
  account: {
    firstName: "Admin",
    lastName: "",
    displayName: "Admin",
    email: "admin@nexora-aitos.com",
    phone: "",
    country: "ไทย",
    accountType: "Super Administrator",
    kyc: "verified",
    tier: "Enterprise",
  },
  security: {
    twoFactor: true,
    passkey: false,
    biometric: false,
    ipWhitelist: false,
    withdrawalLock: true,
    antiPhishingCode: "",
    confirmSensitive: true,
    sessionTimeoutMin: 30,
  },
  trading: {
    market: "crypto",
    venue: "binance",
    contract: "futures",
    marginMode: "isolated",
    direction: "both",
    orderType: "limit",
    timeInForce: "GTC",
    positionPct: 5,
    leverage: 5,
    takeProfitPct: 3,
    stopLossPct: 1.5,
    trailing: false,
    reduceOnly: false,
    postOnly: false,
    slippagePct: 0.05,
  },
  risk: {
    maxLeverage: 15,
    riskPerTradePct: 0.35,
    dailyLossLimitPct: 2,
    weeklyLossLimitPct: 5,
    maxDrawdownPct: 5,
    marginUsageLimitPct: 40,
    maxOpenPositions: 5,
    perSymbolExposurePct: 20,
    perVenueExposurePct: 50,
    correlationLimit: 0.7,
    minLiquidationDistancePct: 8,
    consecutiveLossLimit: 4,
    newsLockoutMin: 30,
  },
  ai: {
    mode: "recommend",
    minConfidence: 60,
    minConsensus: 55,
    minRiskReward: 1.5,
    autoRebalance: false,
    autoHedge: false,
    dynamicLeverage: true,
    autoReduce: true,
    modelVersionLock: false,
    tradingHours: { from: "00:00", to: "23:59", restricted: false },
  },
  notifications: {
    channels: { inApp: true, email: true, sms: false, telegram: true, line: false, webhook: false },
    events: {
      tradeOpened: true,
      tradeClosed: true,
      stopLoss: true,
      takeProfit: true,
      marginWarning: true,
      drawdownAlert: true,
      aiDecision: false,
      exchangeError: true,
      modelUpdate: false,
      securityAlert: true,
      dailyReport: true,
    },
    digest: "instant",
  },
  display: {
    language: "th",
    theme: "dark",
    accent: "#00d4ff",
    fontScale: "normal",
    numberFormat: "thousands",
    referenceCurrency: "USDT",
    timezone: "Asia/Bangkok",
    dateFormat: "YYYY-MM-DD",
    time24h: true,
    layout: "comfortable",
    hideBalances: false,
  },
  data: {
    marketProvider: "Binance",
    newsProvider: "Yahoo Finance",
    onchainProvider: "blockchain.info + mempool.space",
    refreshRateSec: 5,
    staleThresholdSec: 30,
    priceDeviationPct: 0.5,
    preferredVenue: "binance",
  },
};

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

const KEY = "nexora-settings-v1";
const AUDIT_KEY = "nexora-settings-audit-v1";

/** Merge stored values over the defaults so new fields survive an upgrade. */
export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<Settings>;
    return deepMerge(DEFAULT_SETTINGS, saved);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked — the in-memory state still holds */
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function deepMerge<T>(base: T, over: any): T {
  if (over === null || over === undefined) return base;
  if (typeof base !== "object" || Array.isArray(base)) return (over ?? base) as T;
  const out: any = { ...base };
  for (const k of Object.keys(base as any)) {
    if (k in over) out[k] = deepMerge((base as any)[k], over[k]);
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ------------------------------------------------------------------ *
 * Audit trail — the genuinely verifiable part of this page
 * ------------------------------------------------------------------ */

export type AuditEntry = {
  id: string;
  time: number;
  actor: string;
  ip: string;
  path: string;
  label: string;
  from: string;
  to: string;
  critical: boolean;
  result: "saved" | "reverted";
};

/** Changes that alter money-at-risk or access — never purgeable from the UI. */
const CRITICAL_PATHS = new Set([
  "risk.maxLeverage",
  "risk.dailyLossLimitPct",
  "risk.maxDrawdownPct",
  "risk.riskPerTradePct",
  "ai.mode",
  "security.twoFactor",
  "security.withdrawalLock",
  "role",
]);

export function loadAudit(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) ?? "[]") as AuditEntry[];
  } catch {
    return [];
  }
}

export function appendAudit(entries: AuditEntry[]): AuditEntry[] {
  const all = [...entries, ...loadAudit()].slice(0, 500);
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(all));
  } catch {
    /* non-fatal */
  }
  return all;
}

/** Diffs two settings objects into one audit row per changed leaf value. */
export function diffSettings(
  before: Settings,
  after: Settings,
  now: number,
  actor: string,
): AuditEntry[] {
  const rows: AuditEntry[] = [];
  const walk = (a: unknown, b: unknown, path: string) => {
    if (typeof a === "object" && a !== null && !Array.isArray(a)) {
      for (const k of Object.keys(a as Record<string, unknown>)) {
        walk(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)?.[k],
          path ? `${path}.${k}` : k,
        );
      }
      return;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      rows.push({
        id: `${path}-${now}-${rows.length}`,
        time: now,
        actor,
        ip: "127.0.0.1 (เซสชันภายในเบราว์เซอร์)",
        path,
        label: LABELS[path] ?? path,
        from: String(a),
        to: String(b),
        critical: CRITICAL_PATHS.has(path),
        result: "saved",
      });
    }
  };
  walk(before, after, "");
  return rows;
}

/** Human labels for the dotted setting paths that show up in the audit log. */
const LABELS: Record<string, string> = {
  role: "บทบาทผู้ใช้",
  "risk.maxLeverage": "Leverage สูงสุด",
  "risk.riskPerTradePct": "ความเสี่ยงต่อไม้",
  "risk.dailyLossLimitPct": "ขีดจำกัดขาดทุนรายวัน",
  "risk.maxDrawdownPct": "Drawdown สูงสุด",
  "risk.maxOpenPositions": "จำนวน Position สูงสุด",
  "ai.mode": "โหมดการทำงานของ AI",
  "ai.minConfidence": "ความมั่นใจ AI ขั้นต่ำ",
  "security.twoFactor": "การยืนยันสองชั้น (2FA)",
  "security.withdrawalLock": "ล็อกการถอนเงิน",
  "trading.leverage": "Leverage เริ่มต้น",
  "display.language": "ภาษา",
  "display.theme": "ธีมการแสดงผล",
  "display.referenceCurrency": "สกุลเงินอ้างอิง",
};

/* ------------------------------------------------------------------ *
 * Security score — computed from the toggles that are actually set
 * ------------------------------------------------------------------ */

export type SecurityFactor = { th: string; on: boolean; weight: number };

export function securityFactors(s: Settings): SecurityFactor[] {
  return [
    { th: "เปิดการยืนยันสองชั้น (2FA)", on: s.security.twoFactor, weight: 30 },
    { th: "ล็อกการถอนเงิน", on: s.security.withdrawalLock, weight: 20 },
    { th: "ยืนยันก่อนทำรายการที่มีความเสี่ยง", on: s.security.confirmSensitive, weight: 15 },
    { th: "ตั้งรหัสกันฟิชชิง", on: s.security.antiPhishingCode.length >= 4, weight: 10 },
    { th: "จำกัด IP ที่เข้าถึงได้", on: s.security.ipWhitelist, weight: 10 },
    { th: "เปิด Passkey", on: s.security.passkey, weight: 8 },
    { th: "ตั้งเวลาออกจากระบบอัตโนมัติ ≤ 30 นาที", on: s.security.sessionTimeoutMin <= 30, weight: 7 },
  ];
}

export function securityScore(s: Settings): number {
  return securityFactors(s).reduce((sum, f) => sum + (f.on ? f.weight : 0), 0);
}

/* ------------------------------------------------------------------ *
 * Risk validation — the impact preview shown before saving
 * ------------------------------------------------------------------ */

export type RiskWarning = { level: "danger" | "warn"; text: string };

export function riskWarnings(r: Settings["risk"], t: Settings["trading"]): RiskWarning[] {
  const w: RiskWarning[] = [];
  if (r.maxLeverage >= 20)
    w.push({ level: "danger", text: `Leverage สูงสุด ${r.maxLeverage}x — ราคาสวนเพียง ${(100 / r.maxLeverage).toFixed(1)}% ก็ถึงจุดล้างพอร์ต` });
  else if (r.maxLeverage >= 10)
    w.push({ level: "warn", text: `Leverage สูงสุด ${r.maxLeverage}x เพิ่มโอกาสถูกบังคับปิดสถานะในช่วงผันผวน` });
  if (t.leverage > r.maxLeverage)
    w.push({ level: "danger", text: `Leverage เริ่มต้น ${t.leverage}x เกินเพดานความเสี่ยง ${r.maxLeverage}x — Risk Engine จะปฏิเสธ` });
  if (r.riskPerTradePct > 1)
    w.push({ level: "warn", text: `เสี่ยง ${r.riskPerTradePct}% ต่อไม้ — แพ้ติดกัน ${r.consecutiveLossLimit} ไม้จะเสียราว ${(r.riskPerTradePct * r.consecutiveLossLimit).toFixed(1)}% ของทุน` });
  if (r.maxDrawdownPct > r.weeklyLossLimitPct)
    w.push({ level: "warn", text: `Drawdown สูงสุด ${r.maxDrawdownPct}% หลวมกว่าขีดจำกัดขาดทุนรายสัปดาห์ ${r.weeklyLossLimitPct}%` });
  if (r.dailyLossLimitPct > r.weeklyLossLimitPct)
    w.push({ level: "danger", text: `ขีดจำกัดรายวัน ${r.dailyLossLimitPct}% สูงกว่ารายสัปดาห์ ${r.weeklyLossLimitPct}% — ตั้งค่าขัดแย้งกัน` });
  if (r.minLiquidationDistancePct < 5)
    w.push({ level: "warn", text: `ระยะถึงการบังคับปิดขั้นต่ำ ${r.minLiquidationDistancePct}% แคบ อาจโดนกวาดในช่วงข่าว` });
  return w;
}

/* ------------------------------------------------------------------ *
 * Static reference data for the panels
 * ------------------------------------------------------------------ */

export const AI_MODES: { id: Settings["ai"]["mode"]; th: string; detail: string }[] = [
  { id: "monitor", th: "เฝ้าดูอย่างเดียว", detail: "AI วิเคราะห์แต่ไม่เสนอและไม่เทรด" },
  { id: "recommend", th: "แนะนำ", detail: "เสนอสัญญาณให้คนตัดสินใจส่งเอง" },
  { id: "semiAuto", th: "กึ่งอัตโนมัติ", detail: "เตรียมคำสั่งให้ รอคนกดยืนยัน" },
  { id: "fullAuto", th: "อัตโนมัติเต็มรูปแบบ", detail: "เปิด/ปิดสถานะเองภายใต้ Risk Engine" },
  { id: "capitalPreservation", th: "รักษาเงินทุน", detail: "ลดความเสี่ยง ปิดสถานะเสี่ยงสูง" },
  { id: "pause", th: "หยุดชั่วคราว", detail: "พักการทำงานทั้งหมด" },
];

export const NOTIF_EVENTS: { id: string; th: string }[] = [
  { id: "tradeOpened", th: "เปิดสถานะ" },
  { id: "tradeClosed", th: "ปิดสถานะ" },
  { id: "stopLoss", th: "ชน Stop Loss" },
  { id: "takeProfit", th: "ถึง Take Profit" },
  { id: "marginWarning", th: "เตือน Margin" },
  { id: "drawdownAlert", th: "เตือน Drawdown" },
  { id: "aiDecision", th: "การตัดสินใจของ AI" },
  { id: "exchangeError", th: "ข้อผิดพลาดกระดานเทรด" },
  { id: "modelUpdate", th: "อัปเดตโมเดล" },
  { id: "securityAlert", th: "แจ้งเตือนความปลอดภัย" },
  { id: "dailyReport", th: "รายงานประจำวัน" },
];

export const NOTIF_CHANNELS: { id: string; th: string; real: boolean }[] = [
  { id: "inApp", th: "ในระบบ", real: true },
  { id: "email", th: "อีเมล", real: false },
  { id: "sms", th: "SMS", real: false },
  { id: "telegram", th: "เทเลแกรม", real: false },
  { id: "line", th: "LINE", real: false },
  { id: "webhook", th: "เว็บฮุก", real: false },
];

export const PERMISSION_ROLES: { th: string; en: string; scope: string }[] = [
  { th: "เจ้าของ", en: "Owner", scope: "ทุกหมวด รวมการเรียกเก็บเงินและการปิดบัญชี" },
  { th: "นักเทรด", en: "Trader", scope: "ส่งคำสั่งและจัดการสถานะในพอร์ตที่ได้รับสิทธิ์" },
  { th: "นักวิเคราะห์", en: "Analyst", scope: "ดูข้อมูลและรายงาน แก้ไขไม่ได้" },
  { th: "ผู้จัดการความเสี่ยง", en: "Risk Manager", scope: "ตั้ง Risk Policy และอนุมัติการเปลี่ยนแปลง" },
  { th: "นักพัฒนาเชิงปริมาณ", en: "Quant Developer", scope: "โมเดล ชุดข้อมูล และสภาพแวดล้อมทดสอบ" },
  { th: "ผู้ดูแลระบบ", en: "System Admin", scope: "API โครงสร้างพื้นฐาน และความปลอดภัย" },
  { th: "ผู้ชม", en: "Viewer", scope: "ดูอย่างเดียว" },
  { th: "ผู้ตรวจสอบ", en: "Auditor", scope: "อ่านบันทึกตรวจสอบทั้งหมด แก้ไขไม่ได้" },
];

export const KNOWN_VENUES: { id: string; name: string; note: string }[] = [
  { id: "binance", name: "Binance", note: "ใช้เป็นแหล่งราคาและแท่งเทียนจริงอยู่แล้ว" },
  { id: "bybit", name: "Bybit", note: "ตรวจสถานะและความหน่วงได้ ยังไม่รองรับดึงประวัติ" },
  { id: "okx", name: "OKX", note: "ตรวจสถานะและความหน่วงได้" },
  { id: "bitget", name: "Bitget", note: "ตรวจสถานะและความหน่วงได้" },
  { id: "hyperliquid", name: "Hyperliquid", note: "ตรวจสถานะได้" },
  { id: "ibkr", name: "Interactive Brokers", note: "ยังไม่รองรับ" },
];

export function settingsToJson(s: Settings): string {
  return JSON.stringify(s, null, 2);
}
