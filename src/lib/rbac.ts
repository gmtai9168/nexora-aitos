/**
 * Role-Based Access Control — the 9-level permission model.
 *
 * This is the permission LAYER: which role sees which page, and at what level
 * (full / view-only / demo / hidden). It is enforced in the sidebar (hide
 * hidden pages, badge the rest) and by a route guard. Real account/auth/KYC/
 * billing is a separate backend phase; here the role is held client-side so the
 * whole matrix is demonstrable via the role switcher.
 */

export type Role =
  | "guest"
  | "personal"
  | "pro"
  | "company"
  | "quant"
  | "fund"
  | "risk"
  | "admin"
  | "founder";

/** full = ✅ use, view = 👁 read-only, demo = sample only, none = ❌ hidden. */
export type Access = "full" | "view" | "demo" | "none";

/** Column order of the permission matrix below. */
export const ROLE_ORDER: Role[] = [
  "guest",
  "personal",
  "pro",
  "company",
  "quant",
  "fund",
  "risk",
  "admin",
  "founder",
];

export const ROLES: Record<Role, { th: string; en: string; level: number; desc: string }> = {
  guest: { th: "ผู้เยี่ยมชม", en: "Guest", level: 1, desc: "ยังไม่สมัคร · ดูตัวอย่างระบบ" },
  personal: { th: "นักลงทุนทั่วไป", en: "Personal Trader", level: 2, desc: "เทรดเดอร์รายย่อย" },
  pro: { th: "เทรดเดอร์มืออาชีพ", en: "Professional Trader", level: 3, desc: "Full-time trader · ต้อง KYC" },
  company: { th: "ทีม / บริษัท", en: "Team / Company", level: 4, desc: "หลายผู้ใช้ในองค์กร" },
  quant: { th: "นักพัฒนา Quant", en: "Quant Developer", level: 5, desc: "โมเดล/ดาต้า · ไม่ใช้เงินจริง" },
  fund: { th: "ผู้จัดการกองทุน", en: "Fund Manager", level: 6, desc: "บริหาร AUM / นักลงทุน" },
  risk: { th: "ผู้จัดการความเสี่ยง", en: "Risk Manager", level: 7, desc: "อนุมัติ/ปฏิเสธ/หยุดฉุกเฉิน" },
  admin: { th: "ผู้ดูแลระบบ", en: "System Administrator", level: 8, desc: "ดูแลระบบ · ถอนเงินไม่ได้" },
  founder: { th: "เจ้าของ / ผู้ก่อตั้ง", en: "Super Admin / Founder", level: 9, desc: "สิทธิ์เต็มทุกอย่าง" },
};

const F: Access = "full";
const V: Access = "view";
const D: Access = "demo";
const X: Access = "none";

export type PageDef = {
  href: string;
  th: string;
  en: string;
  /** Access per role, in ROLE_ORDER. */
  acc: Access[];
};

/**
 * The 15-page matrix from the spec, plus the extra routes the app already has
 * (given sensible defaults aligned with the nearest matrix page).
 */
export const PAGES: PageDef[] = [
  //                                                    guest per  pro  comp quant fund risk admin found
  { href: "/", th: "แดชบอร์ด", en: "Command Center", acc: [D, F, F, F, V, F, F, F, F] },
  { href: "/ai-network", th: "เครือข่าย AI 50", en: "AI Network", acc: [X, X, V, V, F, V, F, F, F] },
  { href: "/markets", th: "ข้อมูลเหรียญ", en: "Coin Intelligence", acc: [D, F, F, F, F, F, F, F, F] },
  { href: "/execution", th: "การส่งคำสั่งสด", en: "Live Execution", acc: [X, F, F, F, V, F, F, V, F] },
  { href: "/portfolio", th: "พอร์ตการลงทุน", en: "Portfolio", acc: [X, F, F, F, V, F, F, V, F] },
  { href: "/strategies", th: "กลยุทธ์", en: "Strategy Lab", acc: [X, X, F, F, F, V, V, V, F] },
  { href: "/backtest", th: "ทดสอบย้อนหลัง", en: "Backtesting", acc: [X, X, F, F, F, V, V, V, F] },
  { href: "/risk", th: "ระบบความเสี่ยง", en: "Risk Engine", acc: [X, V, V, V, V, F, F, V, F] },
  { href: "/ai-learning", th: "การเรียนรู้ AI", en: "AI Learning", acc: [X, X, X, X, F, X, V, F, F] },
  { href: "/market-intelligence", th: "ตลาดโลก", en: "Market Intelligence", acc: [D, F, F, F, F, F, F, V, F] },
  { href: "/autonomous", th: "ศูนย์อัตโนมัติ", en: "AI Command", acc: [X, X, X, X, V, F, F, V, F] },
  { href: "/performance", th: "วิเคราะห์ผลงาน", en: "Performance", acc: [D, F, F, F, F, F, F, V, F] },
  { href: "/fund", th: "บริหารกองทุน", en: "Fund Operations", acc: [X, X, X, X, X, F, F, V, F] },
  { href: "/war-room", th: "ห้องบัญชาการ", en: "AI War Room", acc: [X, X, X, X, V, V, F, F, F] },
  { href: "/system-ops", th: "ระบบและโครงสร้าง", en: "System Operations", acc: [X, X, X, X, V, X, X, F, F] },
  { href: "/executive", th: "ศูนย์ผู้บริหาร", en: "Executive Center", acc: [X, X, X, X, X, V, V, V, F] },
  // Extra routes (not numbered in the spec) — aligned with the nearest page.
  { href: "/testnet", th: "เทรดทดสอบ", en: "Testnet Execution", acc: [X, F, F, F, V, F, F, V, F] },
  { href: "/history", th: "ประวัติการเทรด", en: "Trade History", acc: [X, F, F, F, V, F, F, V, F] },
  { href: "/alerts", th: "การแจ้งเตือน", en: "Alerts", acc: [X, F, F, F, V, F, F, F, F] },
  { href: "/settings", th: "ตั้งค่า", en: "Settings", acc: [X, F, F, F, F, F, F, F, F] },
];

const PAGE_BY_HREF = new Map(PAGES.map((p) => [p.href, p]));
const ROLE_INDEX: Record<Role, number> = Object.fromEntries(
  ROLE_ORDER.map((r, i) => [r, i]),
) as Record<Role, number>;

/** The access level a role has to a route. Unknown routes default to full. */
export function accessFor(role: Role, href: string): Access {
  const page = PAGE_BY_HREF.get(href);
  if (!page) return "full"; // non-gated utility routes (login, onboarding, …)
  return page.acc[ROLE_INDEX[role]] ?? "none";
}

/** Can this role open the route at all (full / view / demo)? */
export function canOpen(role: Role, href: string): boolean {
  return accessFor(role, href) !== "none";
}

/** Can this role change things on the route (full only)? */
export function canEdit(role: Role, href: string): boolean {
  return accessFor(role, href) === "full";
}

export const ACCESS_META: Record<Access, { th: string; badge: string; tone: string }> = {
  full: { th: "ใช้งานเต็มรูปแบบ", badge: "", tone: "text-up" },
  view: { th: "ดูอย่างเดียว", badge: "👁", tone: "text-warn" },
  demo: { th: "ตัวอย่าง (Demo)", badge: "Demo", tone: "text-dim" },
  none: { th: "ไม่มีสิทธิ์", badge: "", tone: "text-down" },
};
