import type { ExchangeHealth } from "./market-context";
import type { Quote } from "./types";

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export const SEVERITY_META: Record<
  Severity,
  { th: string; en: string; color: string; bg: string; rank: number }
> = {
  critical: { th: "สำคัญเร่งด่วน", en: "Critical", color: "#ff4a68", bg: "#2c1119", rank: 5 },
  high: { th: "สำคัญ", en: "High", color: "#ffb020", bg: "#2d2310", rank: 4 },
  medium: { th: "ปานกลาง", en: "Medium", color: "#facc15", bg: "#241f0d", rank: 3 },
  low: { th: "ต่ำ", en: "Low", color: "#3b9dff", bg: "#0e1c2c", rank: 2 },
  info: { th: "ข้อมูล", en: "Info", color: "#6b8497", bg: "#111e28", rank: 1 },
};

export type AlertStatus =
  | "unread"
  | "read"
  | "acknowledged"
  | "investigating"
  | "resolved"
  | "autoResolved";

export const STATUS_META: Record<AlertStatus, { th: string; color: string; done: boolean }> = {
  unread: { th: "ยังไม่อ่าน", color: "#ff4a68", done: false },
  read: { th: "อ่านแล้ว", color: "#6b8497", done: false },
  acknowledged: { th: "รับทราบแล้ว", color: "#3b9dff", done: false },
  investigating: { th: "กำลังตรวจสอบ", color: "#ffb020", done: false },
  resolved: { th: "ปิดเหตุการณ์แล้ว", color: "#14e2a0", done: true },
  autoResolved: { th: "ระบบแก้ไขอัตโนมัติ", color: "#14e2a0", done: true },
};

export type AlertSource =
  | "risk"
  | "market"
  | "exchange"
  | "sysops"
  | "execution"
  | "ai"
  | "backtest";

export const SOURCE_META: Record<AlertSource, { th: string; en: string; href: string }> = {
  risk: { th: "ระบบความเสี่ยง", en: "Risk Engine", href: "/risk" },
  market: { th: "ตลาดโลก", en: "Market Intelligence", href: "/market-intelligence" },
  exchange: { th: "เกตเวย์ตลาด", en: "Exchange Gateway", href: "/execution" },
  sysops: { th: "ระบบและโครงสร้าง", en: "System Operations", href: "/system-ops" },
  execution: { th: "การส่งคำสั่งสด", en: "Live Execution", href: "/execution" },
  ai: { th: "เครือข่าย AI", en: "AI Network", href: "/ai-network" },
  backtest: { th: "ทดสอบย้อนหลัง", en: "Backtesting", href: "/backtest" },
};

export type AlertKind = "critical" | "warning" | "pending" | "info" | "done" | "ai" | "shield";

/* ------------------------------------------------------------------ *
 * What the detector gets to look at — all of it measured
 * ------------------------------------------------------------------ */

export type Snapshot = {
  ts: number;
  quotes: Quote[];
  exchanges: ExchangeHealth[];
  health: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
    systemUsedPct: number;
    uptimeSec: number;
  } | null;
  context: {
    symbol: string;
    funding: number | null;
    oiChangePct: number | null;
    takerBuyShare: number | null;
    longAccount: number | null;
  } | null;
  venues: { id: string; name: string; price: number | null; latency: number; online: boolean }[];
  onchain: { fearGreed: number | null; hashTrendPct: number | null } | null;
  news: { negative: number; positive: number; total: number } | null;
  /** Endpoints that failed on this poll — a real availability signal. */
  failedRoutes: string[];
  emergencyStop: boolean;
};

export const EMPTY_SNAPSHOT: Snapshot = {
  ts: 0,
  quotes: [],
  exchanges: [],
  health: null,
  context: null,
  venues: [],
  onchain: null,
  news: null,
  failedRoutes: [],
  emergencyStop: false,
};

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

export type RuleType =
  | "price"
  | "volatility"
  | "funding"
  | "openInterest"
  | "volume"
  | "latency"
  | "exchangeHealth"
  | "feed"
  | "infrastructure"
  | "security"
  | "news"
  | "sentiment"
  | "pnl"
  | "drawdown"
  | "margin"
  | "liquidation"
  | "aiConfidence"
  | "modelDrift";

export const RULE_TYPE_TH: Record<RuleType, string> = {
  price: "ราคา",
  volatility: "ความผันผวน",
  funding: "Funding Rate",
  openInterest: "Open Interest",
  volume: "ปริมาณซื้อขาย",
  latency: "ความหน่วง API",
  exchangeHealth: "สุขภาพกระดานเทรด",
  feed: "ความถูกต้องของราคา",
  infrastructure: "โครงสร้างพื้นฐาน",
  security: "ความปลอดภัย",
  news: "ข่าว",
  sentiment: "อารมณ์ตลาด",
  pnl: "กำไรขาดทุน",
  drawdown: "Drawdown",
  margin: "Margin",
  liquidation: "ระยะถึงการบังคับปิด",
  aiConfidence: "ความมั่นใจของ AI",
  modelDrift: "โมเดลเบี่ยงเบน",
};

export type Detection = {
  ruleId: string;
  /** Same key on a later poll updates the existing alert instead of adding one. */
  dedupKey: string;
  severity: Severity;
  title: string;
  detail: string;
  observed: string;
  threshold: string;
  impact: string;
  rootCause: string;
  systemResponse: string[];
  entity: { symbol?: string; venue?: string; account?: string };
};

export type Rule = {
  id: string;
  th: string;
  en: string;
  type: RuleType;
  source: AlertSource;
  kind: AlertKind;
  severity: Severity;
  /** Editable number the detector compares against. */
  threshold: number;
  unit: string;
  /**
   * The comparison in words, with `N` standing in for the threshold. Rules
   * differ in which direction a bigger number points, so the settings panel
   * shows this rather than leaving the user to guess.
   */
  condition?: string;
  /** Null when this rule needs data the platform does not have. */
  detect: ((s: Snapshot, threshold: number) => Detection[]) | null;
  /** Why a rule cannot run, shown in the rules manager. */
  unavailable?: string;
  /** True when the rule watches a boolean state and has nothing to tune. */
  fixed?: boolean;
};

const HOT = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];

/* Every detector below reads only measured fields from the snapshot. */
export const RULES: Rule[] = [
  {
    id: "exchange-offline",
    th: "กระดานเทรดขาดการเชื่อมต่อ",
    en: "Exchange API disconnected",
    type: "exchangeHealth",
    source: "exchange",
    kind: "critical",
    severity: "critical",
    threshold: 1,
    unit: "กระดานขึ้นไป",
    condition: "แจ้งเมื่อมีกระดานออฟไลน์ตั้งแต่ N ขึ้นไป (เลขมาก = ไวน้อยลง)",
    detect: (s, th) => {
      const down = s.exchanges.filter((e) => !e.online);
      // Desks that expect one flaky venue can raise the bar to two or more.
      if (down.length < th) return [];
      return down.map((e) => ({
          ruleId: "exchange-offline",
          dedupKey: `exchange-offline:${e.id}`,
          severity: "critical" as Severity,
          title: `${e.name} ขาดการเชื่อมต่อ`,
          detail: `ตรวจสอบสถานะแล้วไม่ตอบสนอง (HTTP ${e.status || "ไม่มีการตอบกลับ"}) ใช้เวลา ${e.latency} ms ก่อนหมดเวลา`,
          observed: `HTTP ${e.status || 0}`,
          threshold: "ต้องตอบ HTTP 200",
          impact: "ไม่สามารถอ่านราคาหรือส่งคำสั่งไปยังกระดานนี้ได้ การกระจายคำสั่งจะเหลือกระดานอื่น",
          rootCause:
            e.status === 451
              ? "กระดานปฏิเสธคำขอจากภูมิภาคของเซิร์ฟเวอร์ (HTTP 451) ไม่ใช่ปัญหาเครือข่าย"
              : "ปลายทางไม่ตอบสนองภายในเวลาที่กำหนด อาจเป็นการบำรุงรักษาหรือปัญหาเครือข่าย",
          systemResponse: [
            "ตัดกระดานนี้ออกจากการเลือกเส้นทางคำสั่งชั่วคราว",
            "ตรวจสอบซ้ำทุกรอบการดึงข้อมูล",
          ],
          entity: { venue: e.name },
        }));
    },
  },
  {
    id: "exchange-latency",
    th: "ความหน่วงของกระดานสูงผิดปกติ",
    en: "Exchange latency degraded",
    type: "latency",
    source: "sysops",
    kind: "warning",
    severity: "high",
    threshold: 900,
    unit: "ms",
    condition: "แจ้งเมื่อความหน่วง > N ms (เลขมาก = ไวน้อยลง)",
    detect: (s, th) =>
      s.exchanges
        .filter((e) => e.online && e.latency > th)
        .map((e) => ({
          ruleId: "exchange-latency",
          dedupKey: `exchange-latency:${e.id}`,
          severity: "high" as Severity,
          title: `${e.name} ตอบสนองช้า ${e.latency} ms`,
          detail: `สูงกว่าเกณฑ์ ${th} ms ที่ตั้งไว้ การส่งคำสั่งอาจได้ราคาต่างจากที่เห็น`,
          observed: `${e.latency} ms`,
          threshold: `≤ ${th} ms`,
          impact: "คำสั่งที่ส่งผ่านกระดานนี้เสี่ยงได้ราคาคลาดเคลื่อน (Slippage) มากกว่าปกติ",
          rootCause: "เวลาไป-กลับที่วัดจากเซิร์ฟเวอร์สูงกว่าค่าปกติ อาจเกิดจากภาระของกระดานหรือเส้นทางเครือข่าย",
          systemResponse: [
            "ลดน้ำหนักกระดานนี้ในการเลือกเส้นทางคำสั่ง",
            "เฝ้าดูจนกว่าค่าจะกลับสู่เกณฑ์",
          ],
          entity: { venue: e.name },
        })),
  },
  {
    id: "feed-dispersion",
    th: "ราคาระหว่างกระดานต่างกันผิดปกติ",
    en: "Cross-venue price dispersion",
    type: "feed",
    source: "market",
    kind: "shield",
    severity: "high",
    threshold: 0.5,
    unit: "%",
    condition: "แจ้งเมื่อส่วนต่างราคาระหว่างกระดาน > N% (เลขมาก = ไวน้อยลง)",
    detect: (s, th) => {
      const live = s.venues.filter((v) => v.online && v.price !== null);
      if (live.length < 3) return [];
      const prices = live.map((v) => v.price!);
      const hi = Math.max(...prices);
      const lo = Math.min(...prices);
      const spread = lo ? ((hi - lo) / lo) * 100 : 0;
      if (spread <= th) return [];
      const hiV = live.find((v) => v.price === hi)!;
      const loV = live.find((v) => v.price === lo)!;
      return [
        {
          ruleId: "feed-dispersion",
          dedupKey: "feed-dispersion",
          severity: "high" as Severity,
          title: `ราคาต่างกันระหว่างกระดาน ${spread.toFixed(3)}%`,
          detail: `${hiV.name} ${hi.toFixed(2)} เทียบกับ ${loV.name} ${lo.toFixed(2)} จาก ${live.length} กระดานที่อ่านได้`,
          observed: `${spread.toFixed(3)}%`,
          threshold: `≤ ${th}%`,
          impact: "ราคาอ้างอิงอาจไม่น่าเชื่อถือ การคำนวณมูลค่าพอร์ตและการวางคำสั่งอาจคลาดเคลื่อน",
          rootCause:
            "ส่วนต่างขนาดนี้มักเกิดจากสภาพคล่องบางลงในบางกระดาน ราคาค้าง หรือเกิดโอกาสอาร์บิทราจจริง",
          systemResponse: ["ใช้ราคามัธยฐานจากหลายกระดานแทนราคาเดียว", "ทำเครื่องหมายราคาที่ผิดปกติไว้"],
          entity: { symbol: "BTCUSDT" },
        },
      ];
    },
  },
  {
    id: "route-failure",
    th: "บริการข้อมูลภายในล้มเหลว",
    en: "Internal data route failure",
    type: "infrastructure",
    source: "sysops",
    kind: "critical",
    severity: "critical",
    threshold: 1,
    unit: "เส้นทางขึ้นไป",
    condition: "แจ้งเมื่อมีเส้นทางข้อมูลล้มเหลวตั้งแต่ N ขึ้นไป (เลขมาก = ไวน้อยลง)",
    detect: (s, th) => {
      if (s.failedRoutes.length < th) return [];
      return s.failedRoutes.map((r) => ({
        ruleId: "route-failure",
        dedupKey: `route-failure:${r}`,
        severity: "critical" as Severity,
        title: `ดึงข้อมูลจาก ${r} ไม่สำเร็จ`,
        detail: "เส้นทางข้อมูลภายในไม่ตอบสนองในรอบการตรวจล่าสุด แผงที่พึ่งพาข้อมูลนี้จะแสดงค่าเดิม",
        observed: "ไม่มีการตอบกลับ",
        threshold: "ต้องตอบ HTTP 200",
        impact: "แผงที่ใช้ข้อมูลนี้จะค้างอยู่ที่ค่าล่าสุดจนกว่าจะเชื่อมต่อได้",
        rootCause: "ต้นทางภายนอกไม่ตอบสนอง หมดเวลา หรือถูกจำกัดอัตราการเรียก",
        systemResponse: ["ลองใหม่ในรอบถัดไป", "คงค่าล่าสุดไว้แทนการแสดงค่าว่าง"],
        entity: {},
      }));
    },
  },
  {
    id: "memory-pressure",
    th: "หน่วยความจำเซิร์ฟเวอร์ใกล้เต็ม",
    en: "Server memory pressure",
    type: "infrastructure",
    source: "sysops",
    kind: "warning",
    severity: "high",
    threshold: 85,
    unit: "%",
    condition: "แจ้งเมื่อหน่วยความจำใช้ไป > N% (เลขมาก = ไวน้อยลง)",
    detect: (s, th) => {
      if (!s.health || s.health.systemUsedPct <= th) return [];
      return [
        {
          ruleId: "memory-pressure",
          dedupKey: "memory-pressure",
          severity: "high" as Severity,
          title: `หน่วยความจำระบบใช้ไป ${s.health.systemUsedPct.toFixed(1)}%`,
          detail: `Heap ${s.health.heapUsedMb} MB จาก ${s.health.heapTotalMb} MB · RSS ${s.health.rssMb} MB`,
          observed: `${s.health.systemUsedPct.toFixed(1)}%`,
          threshold: `≤ ${th}%`,
          impact: "การประมวลผลอาจช้าลง และมีโอกาสที่กระบวนการจะถูกระบบปฏิบัติการหยุด",
          rootCause: "ค่าที่อ่านจาก process.memoryUsage() และ os บนเซิร์ฟเวอร์ที่รันอยู่จริง",
          systemResponse: ["บันทึกค่าไว้ในเมตริกระบบ", "เฝ้าดูแนวโน้มการใช้หน่วยความจำ"],
          entity: {},
        },
      ];
    },
  },
  {
    id: "funding-extreme",
    th: "Funding Rate สูงผิดปกติ",
    en: "Funding rate extreme",
    type: "funding",
    source: "market",
    kind: "warning",
    severity: "high",
    threshold: 0.05,
    unit: "%",
    condition: "แจ้งเมื่อ |Funding| > N% (เลขมาก = ไวน้อยลง)",
    detect: (s, th) => {
      const f = s.context?.funding;
      if (f === null || f === undefined || Math.abs(f) <= th) return [];
      const paying = f > 0 ? "ฝั่งซื้อ (Long)" : "ฝั่งขาย (Short)";
      return [
        {
          ruleId: "funding-extreme",
          dedupKey: `funding-extreme:${s.context!.symbol}`,
          severity: "high" as Severity,
          title: `Funding Rate ${f.toFixed(4)}% บน ${s.context!.symbol}`,
          detail: `${paying} เป็นฝ่ายจ่ายทุก 8 ชั่วโมง คิดเป็นราว ${(Math.abs(f) * 3 * 365).toFixed(1)}% ต่อปีหากคงอัตรานี้`,
          observed: `${f.toFixed(4)}%`,
          threshold: `|Funding| ≤ ${th}%`,
          impact: "การถือสถานะฝั่งที่ต้องจ่ายเป็นเวลานานจะถูกกัดกร่อนกำไรจากค่า Funding",
          rootCause: "ตำแหน่งในตลาดสัญญาเอนไปทางเดียวมาก ทำให้อัตรา Funding ถูกผลักไปสุดขั้ว",
          systemResponse: [
            "รวมต้นทุน Funding เข้าไปในการคำนวณผลตอบแทนทุกกลยุทธ์",
            "แจ้งกลยุทธ์ที่ถือสถานะข้ามรอบ Funding",
          ],
          entity: { symbol: s.context!.symbol },
        },
      ];
    },
  },
  {
    id: "oi-surge",
    th: "Open Interest เปลี่ยนแปลงเร็ว",
    en: "Open interest surge",
    type: "openInterest",
    source: "market",
    kind: "warning",
    severity: "medium",
    threshold: 5,
    unit: "%",
    condition: "แจ้งเมื่อ |การเปลี่ยนแปลง OI ใน 1 ชม.| > N% (เลขมาก = ไวน้อยลง)",
    detect: (s, th) => {
      const oi = s.context?.oiChangePct;
      if (oi === null || oi === undefined || Math.abs(oi) <= th) return [];
      return [
        {
          ruleId: "oi-surge",
          dedupKey: `oi-surge:${s.context!.symbol}`,
          severity: "medium" as Severity,
          title: `Open Interest ${oi > 0 ? "เพิ่ม" : "ลด"} ${Math.abs(oi).toFixed(2)}% ในหนึ่งชั่วโมง`,
          detail: `วัดจากสัญญาคงค้างของ ${s.context!.symbol} เทียบกับหนึ่งชั่วโมงก่อนหน้า`,
          observed: `${oi.toFixed(2)}%`,
          threshold: `|ΔOI| ≤ ${th}%`,
          impact:
            oi > 0
              ? "มีเงินใหม่ไหลเข้าตลาดสัญญา แนวโน้มปัจจุบันอาจเร่งตัวและความผันผวนสูงขึ้น"
              : "สถานะถูกปิดออกจำนวนมาก อาจเกิดการบังคับปิดสถานะเป็นลูกโซ่",
          rootCause: "ข้อมูลสัญญาคงค้างย้อนหลัง 1 ชั่วโมงจากตลาดสัญญา",
          systemResponse: ["ปรับระดับความผันผวนที่ใช้กำหนดขนาดไม้", "เฝ้าดูสัญญาณการบังคับปิดสถานะ"],
          entity: { symbol: s.context!.symbol },
        },
      ];
    },
  },
  {
    id: "taker-imbalance",
    th: "แรงซื้อขายเอียงไปด้านเดียว",
    en: "Taker flow imbalance",
    type: "volume",
    source: "market",
    kind: "info",
    severity: "medium",
    threshold: 70,
    unit: "%",
    condition: "แจ้งเมื่อสัดส่วนฝั่งซื้อ > N% หรือ < (100−N)% (เลขมาก = ไวน้อยลง)",
    detect: (s, th) => {
      const t = s.context?.takerBuyShare;
      if (t === null || t === undefined) return [];
      if (t <= th && t >= 100 - th) return [];
      const buy = t > 50;
      return [
        {
          ruleId: "taker-imbalance",
          dedupKey: `taker-imbalance:${s.context!.symbol}`,
          severity: "medium" as Severity,
          title: `แรง${buy ? "ซื้อ" : "ขาย"}ครองตลาด ${(buy ? t : 100 - t).toFixed(1)}%`,
          detail: `จากคำสั่งจริง 1,000 รายการล่าสุดของ ${s.context!.symbol}`,
          observed: `${t.toFixed(1)}% เป็นฝั่งซื้อ`,
          threshold: `อยู่ระหว่าง ${100 - th}% ถึง ${th}%`,
          impact: "แรงด้านเดียวที่มากผิดปกติมักตามมาด้วยการเคลื่อนไหวแรงและการย่อตัวกลับ",
          rootCause: "นับจากธงผู้เป็นฝ่ายเคาะซื้อ/เคาะขายในรายการซื้อขายจริงล่าสุด",
          systemResponse: ["ป้อนค่านี้ให้โมเดลอ่านแรงซื้อขาย", "เพิ่มความถี่ตรวจสอบสภาพคล่อง"],
          entity: { symbol: s.context!.symbol },
        },
      ];
    },
  },
  {
    id: "price-move",
    th: "ราคาเคลื่อนไหวรุนแรง",
    en: "Large price move",
    type: "price",
    source: "market",
    kind: "warning",
    severity: "medium",
    threshold: 5,
    unit: "%",
    condition: "แจ้งเมื่อ |เปลี่ยนแปลง 24 ชม.| > N% และยกเป็นระดับสำคัญเมื่อเกินสองเท่าของเกณฑ์ (เลขมาก = ไวน้อยลง)",
    detect: (s, th) =>
      s.quotes
        .filter((q) => HOT.includes(q.symbol) && Math.abs(q.changePct) > th)
        .map((q) => {
          const severe = Math.abs(q.changePct) > th * 2;
          return {
            ruleId: "price-move",
            dedupKey: `price-move:${q.symbol}`,
            severity: (severe ? "high" : "medium") as Severity,
            title: `${q.display} ${q.changePct > 0 ? "ขึ้น" : "ลง"} ${Math.abs(q.changePct).toFixed(2)}% ใน 24 ชั่วโมง`,
            detail: `ราคาปัจจุบัน ${q.price.toLocaleString()} · สูงสุด ${q.high.toLocaleString()} · ต่ำสุด ${q.low.toLocaleString()}`,
            observed: `${q.changePct.toFixed(2)}%`,
            threshold: `|Δ| ≤ ${th}%`,
            impact: "สถานะที่เปิดอยู่บนคู่นี้จะได้รับผลกระทบโดยตรง และระยะถึงจุดตัดขาดทุนแคบลง",
            rootCause: "ค่าเปลี่ยนแปลง 24 ชั่วโมงจากราคาซื้อขายจริง",
            systemResponse: ["ปรับขนาดไม้ตามความผันผวนที่สูงขึ้น", "ทบทวนระยะจุดตัดขาดทุนของกลยุทธ์ที่เกี่ยวข้อง"],
            entity: { symbol: q.symbol },
          };
        }),
  },
  {
    id: "range-expansion",
    th: "ช่วงราคากว้างผิดปกติ",
    en: "Intraday range expansion",
    type: "volatility",
    source: "market",
    kind: "warning",
    severity: "medium",
    threshold: 8,
    unit: "%",
    condition: "แจ้งเมื่อกรอบราคา 24 ชม. > N% (เลขมาก = ไวน้อยลง)",
    detect: (s, th) =>
      s.quotes
        .filter((q) => {
          if (!HOT.includes(q.symbol) || !q.low) return false;
          return ((q.high - q.low) / q.low) * 100 > th;
        })
        .map((q) => {
          const range = ((q.high - q.low) / q.low) * 100;
          return {
            ruleId: "range-expansion",
            dedupKey: `range-expansion:${q.symbol}`,
            severity: "medium" as Severity,
            title: `${q.display} แกว่งในกรอบ ${range.toFixed(2)}% ใน 24 ชั่วโมง`,
            detail: `สูงสุด ${q.high.toLocaleString()} · ต่ำสุด ${q.low.toLocaleString()}`,
            observed: `${range.toFixed(2)}%`,
            threshold: `≤ ${th}%`,
            impact: "ความผันผวนที่สูงขึ้นทำให้จุดตัดขาดทุนถูกแตะง่ายขึ้นหากไม่ปรับขนาดไม้",
            rootCause: "ระยะห่างระหว่างราคาสูงสุดและต่ำสุดใน 24 ชั่วโมงจากข้อมูลจริง",
            systemResponse: ["ขยายระยะจุดตัดขาดทุนตามค่า ATR", "ลดขนาดไม้ให้ความเสี่ยงต่อไม้คงเดิม"],
            entity: { symbol: q.symbol },
          };
        }),
  },
  {
    id: "crowded-positioning",
    th: "สถานะในตลาดแออัดด้านเดียว",
    en: "Crowded positioning",
    type: "openInterest",
    source: "risk",
    kind: "shield",
    severity: "medium",
    threshold: 70,
    unit: "%",
    condition: "แจ้งเมื่อบัญชีฝั่งซื้อ > N% หรือ < (100−N)% (เลขมาก = ไวน้อยลง)",
    detect: (s, th) => {
      const l = s.context?.longAccount;
      if (l === null || l === undefined) return [];
      if (l <= th && l >= 100 - th) return [];
      const long = l > 50;
      return [
        {
          ruleId: "crowded-positioning",
          dedupKey: `crowded-positioning:${s.context!.symbol}`,
          severity: "medium" as Severity,
          title: `บัญชี${long ? "ฝั่งซื้อ" : "ฝั่งขาย"}หนาแน่น ${(long ? l : 100 - l).toFixed(1)}%`,
          detail: `สัดส่วนบัญชีที่ถือสถานะบน ${s.context!.symbol} ในตลาดสัญญา`,
          observed: `${l.toFixed(1)}% เป็นฝั่งซื้อ`,
          threshold: `อยู่ระหว่าง ${100 - th}% ถึง ${th}%`,
          impact: "ฝั่งที่แออัดมักเป็นเป้าของการกวาดสภาพคล่อง ซึ่งจบด้วยการบังคับปิดสถานะเป็นลูกโซ่",
          rootCause: "อัตราส่วนบัญชีถือสถานะซื้อ/ขายจากตลาดสัญญา",
          systemResponse: ["เพิ่มน้ำหนักความเสี่ยงให้ฝั่งที่แออัด", "จำกัดการเปิดสถานะตามฝูงชน"],
          entity: { symbol: s.context!.symbol },
        },
      ];
    },
  },
  {
    id: "sentiment-extreme",
    th: "อารมณ์ตลาดสุดขั้ว",
    en: "Sentiment extreme",
    type: "sentiment",
    source: "market",
    kind: "info",
    severity: "low",
    threshold: 20,
    unit: "จุด",
    condition: "แจ้งเมื่อดัชนี ≤ N หรือ ≥ (100−N) — เลขมาก = ไวมากขึ้น",
    detect: (s, th) => {
      const fg = s.onchain?.fearGreed;
      if (fg === null || fg === undefined) return [];
      if (fg > th && fg < 100 - th) return [];
      const fear = fg <= th;
      return [
        {
          ruleId: "sentiment-extreme",
          dedupKey: "sentiment-extreme",
          severity: "low" as Severity,
          title: `ดัชนีความกลัว/โลภอยู่ที่ ${fg} — ${fear ? "กลัวสุดขีด" : "โลภสุดขีด"}`,
          detail: "ดัชนีรวมความผันผวน โมเมนตัม โซเชียล และส่วนแบ่งตลาดของบิตคอยน์",
          observed: `${fg} จุด`,
          threshold: `อยู่ระหว่าง ${th} ถึง ${100 - th}`,
          impact: "ค่าสุดขั้วทั้งสองด้านมักเกิดใกล้จุดกลับตัวของตลาดมากกว่ากลางแนวโน้ม",
          rootCause: "ค่าจากดัชนี Fear & Greed สาธารณะ",
          systemResponse: ["ป้อนค่านี้ให้โมเดลอ่านสภาวะตลาด"],
          entity: {},
        },
      ];
    },
  },
  {
    id: "news-negative",
    th: "ข่าวเชิงลบหนาแน่น",
    en: "Negative news cluster",
    type: "news",
    source: "market",
    kind: "warning",
    severity: "medium",
    threshold: 4,
    unit: "ข่าว",
    condition: "แจ้งเมื่อมีพาดหัวเชิงลบตั้งแต่ N ข่าวขึ้นไป (เลขมาก = ไวน้อยลง)",
    detect: (s, th) => {
      if (!s.news || s.news.negative < th) return [];
      return [
        {
          ruleId: "news-negative",
          dedupKey: "news-negative",
          severity: "medium" as Severity,
          title: `พบพาดหัวเชิงลบ ${s.news.negative} จาก ${s.news.total} ข่าวล่าสุด`,
          detail: "จัดประเภทด้วยการจับคำสำคัญบนพาดหัวข่าว ไม่ได้ใช้โมเดลภาษา",
          observed: `${s.news.negative} ข่าว`,
          threshold: `< ${th} ข่าว`,
          impact: "ข่าวลบที่กระจุกตัวมักมาพร้อมความผันผวนที่สูงขึ้นในระยะสั้น",
          rootCause: "นับจากคำสำคัญเชิงลบบนพาดหัวข่าวที่ดึงมาได้จริง",
          systemResponse: ["เพิ่มความถี่ตรวจสอบความผันผวน"],
          entity: {},
        },
      ];
    },
  },
  {
    id: "emergency-stop",
    th: "เปิดโหมดหยุดฉุกเฉิน",
    en: "Emergency stop engaged",
    type: "security",
    source: "risk",
    kind: "critical",
    severity: "critical",
    threshold: 1,
    unit: "",
    fixed: true,
    detect: (s) =>
      s.emergencyStop
        ? [
            {
              ruleId: "emergency-stop",
              dedupKey: "emergency-stop",
              severity: "critical" as Severity,
              title: "ระบบอยู่ในโหมดหยุดฉุกเฉิน",
              detail: "บอททั้งหมดถูกพัก ไม่มีการเปิดสถานะใหม่จนกว่าจะยกเลิกโหมดนี้",
              observed: "เปิดใช้งาน",
              threshold: "ปกติต้องปิด",
              impact: "กลยุทธ์ทั้งหมดหยุดทำงาน ไม่มีการประเมินสัญญาณใหม่",
              rootCause: "มีการกดปุ่มหยุดฉุกเฉินจากแถบด้านซ้าย",
              systemResponse: ["พักบอททุกตัว", "ยกเลิกคำสั่งที่ค้างอยู่", "ไม่เปิดสถานะใหม่"],
              entity: {},
            },
          ]
        : [],
  },
  {
    id: "hashrate-drop",
    th: "พลังขุดบิตคอยน์ลดลง",
    en: "Bitcoin hash rate decline",
    type: "infrastructure",
    source: "market",
    kind: "info",
    severity: "low",
    threshold: 12,
    unit: "%",
    condition: "แจ้งเมื่อพลังขุดลดเกิน N% (เลขมาก = ไวน้อยลง)",
    detect: (s, th) => {
      const h = s.onchain?.hashTrendPct;
      if (h === null || h === undefined || h > -th) return [];
      return [
        {
          ruleId: "hashrate-drop",
          dedupKey: "hashrate-drop",
          severity: "low" as Severity,
          title: `พลังขุดลดลง ${Math.abs(h).toFixed(1)}% ในช่วงที่วัด`,
          detail: "วัดจากค่าเฉลี่ยพลังขุดของเครือข่ายบิตคอยน์",
          observed: `${h.toFixed(1)}%`,
          threshold: `ลดไม่เกิน ${th}%`,
          impact: "พลังขุดที่ลดแรงบางครั้งสัมพันธ์กับแรงกดดันฝั่งนักขุด",
          rootCause: "ข้อมูลพลังขุดจากโหนดสาธารณะ",
          systemResponse: ["บันทึกเป็นสัญญาณออนเชน"],
          entity: { symbol: "BTCUSDT" },
        },
      ];
    },
  },

  /* Rules the platform cannot run — listed so the catalogue stays honest. */
  {
    id: "drawdown",
    th: "Drawdown เกินกำหนด",
    en: "Drawdown breach",
    type: "drawdown",
    source: "risk",
    kind: "critical",
    severity: "critical",
    threshold: 15,
    unit: "%",
    detect: null,
    unavailable: "ต้องเชื่อมต่อบัญชีจริงเพื่ออ่านมูลค่าพอร์ตแบบต่อเนื่อง — แพลตฟอร์มนี้ไม่รับ API Key",
  },
  {
    id: "margin-level",
    th: "Margin Level ต่ำกว่าเกณฑ์",
    en: "Margin level low",
    type: "margin",
    source: "risk",
    kind: "critical",
    severity: "critical",
    threshold: 120,
    unit: "%",
    detect: null,
    unavailable: "ต้องมีบัญชีสัญญาจริงจึงจะอ่านระดับมาร์จินได้",
  },
  {
    id: "liquidation-distance",
    th: "ระยะถึงการบังคับปิดสถานะแคบ",
    en: "Liquidation distance",
    type: "liquidation",
    source: "risk",
    kind: "critical",
    severity: "critical",
    threshold: 5,
    unit: "%",
    detect: null,
    unavailable: "ต้องมีสถานะจริงที่เปิดค้างอยู่จึงจะคำนวณระยะได้",
  },
  {
    id: "pnl-threshold",
    th: "กำไรขาดทุนถึงเกณฑ์",
    en: "P&L threshold",
    type: "pnl",
    source: "risk",
    kind: "warning",
    severity: "high",
    threshold: 5,
    unit: "%",
    detect: null,
    unavailable: "ต้องมีพอร์ตจริงที่มีสถานะเปิดอยู่",
  },
  {
    id: "model-drift",
    th: "โมเดล AI เบี่ยงเบน",
    en: "Model drift",
    type: "modelDrift",
    source: "ai",
    kind: "ai",
    severity: "high",
    threshold: 20,
    unit: "%",
    detect: null,
    unavailable: "ต้องมีโมเดลที่ฝึกและให้บริการพยากรณ์อยู่จริงเพื่อวัดการเบี่ยงเบน",
  },
  {
    id: "ai-confidence",
    th: "ความมั่นใจของ AI ลดลง",
    en: "AI confidence drop",
    type: "aiConfidence",
    source: "ai",
    kind: "ai",
    severity: "medium",
    threshold: 55,
    unit: "%",
    detect: null,
    unavailable: "ต้องมีโมเดลที่ให้ค่าความเชื่อมั่นแบบต่อเนื่อง ไม่ใช่ค่าที่คำนวณย้อนหลัง",
  },
  {
    id: "duplicate-order",
    th: "ตรวจพบคำสั่งซ้ำ",
    en: "Duplicate order detected",
    type: "security",
    source: "execution",
    kind: "shield",
    severity: "critical",
    threshold: 1,
    unit: "คำสั่ง",
    detect: null,
    unavailable: "แพลตฟอร์มไม่ส่งคำสั่งจริง จึงไม่มีสายคำสั่งให้ตรวจซ้ำ",
  },
];

export const RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));
export const LIVE_RULES = RULES.filter((r) => r.detect !== null);

/* ------------------------------------------------------------------ *
 * Alert store
 * ------------------------------------------------------------------ */

export type AuditStep = { time: number; actor: string; action: string; detail: string };

export type Alert = {
  id: string;
  dedupKey: string;
  ruleId: string;
  severity: Severity;
  source: AlertSource;
  kind: AlertKind;
  title: string;
  detail: string;
  observed: string;
  threshold: string;
  impact: string;
  rootCause: string;
  systemResponse: string[];
  entity: { symbol?: string; venue?: string; account?: string };
  firstSeen: number;
  lastSeen: number;
  /** How many polls this same condition has fired on — the dedup counter. */
  occurrences: number;
  status: AlertStatus;
  assignee: string | null;
  snoozeUntil: number | null;
  acknowledgedAt: number | null;
  resolvedAt: number | null;
  suppressedByDnd: boolean;
  audit: AuditStep[];
};

export type Preferences = {
  channels: Record<ChannelId, { on: boolean; minSeverity: Severity }>;
  frequency: FrequencyId;
  dnd: { on: boolean; from: string; to: string };
  thresholds: Record<string, number>;
  disabledRules: string[];
  role: RoleId;
};

export type ChannelId = "inApp" | "email" | "sms" | "telegram" | "line" | "webhook";

export const CHANNELS: {
  id: ChannelId;
  th: string;
  en: string;
  connected: boolean;
  note: string;
}[] = [
  { id: "inApp", th: "ในระบบ", en: "In-App", connected: true, note: "แสดงในหน้านี้และนับรวมที่ไอคอนกระดิ่ง" },
  { id: "email", th: "อีเมล", en: "Email", connected: false, note: "ต้องมีผู้ให้บริการส่งอีเมลและโดเมนที่ยืนยันแล้ว" },
  { id: "sms", th: "SMS", en: "SMS", connected: false, note: "ต้องมีเกตเวย์ SMS และมีค่าใช้จ่ายต่อข้อความ" },
  { id: "telegram", th: "เทเลแกรม", en: "Telegram", connected: false, note: "ต้องสร้างบอทและเก็บโทเคนไว้ฝั่งเซิร์ฟเวอร์" },
  { id: "line", th: "LINE", en: "LINE Messaging", connected: false, note: "LINE Notify ปิดให้บริการแล้ว ต้องใช้ Messaging API แทน" },
  { id: "webhook", th: "เว็บฮุก", en: "Webhook", connected: false, note: "ต้องมีปลายทางที่รับได้และลงลายเซ็นด้วยคีย์ลับ" },
];

export type FrequencyId = "instant" | "1m" | "5m" | "hourly" | "daily" | "onChange";

export const FREQUENCIES: { id: FrequencyId; th: string; ms: number }[] = [
  { id: "instant", th: "ทันที", ms: 0 },
  { id: "1m", th: "ทุก 1 นาที", ms: 60_000 },
  { id: "5m", th: "ทุก 5 นาที", ms: 300_000 },
  { id: "hourly", th: "สรุปทุกชั่วโมง", ms: 3_600_000 },
  { id: "daily", th: "สรุปรายวัน", ms: 86_400_000 },
  { id: "onChange", th: "แจ้งครั้งเดียวจนกว่าสถานะจะเปลี่ยน", ms: Infinity },
];

export type RoleId =
  | "personal"
  | "professional"
  | "fundManager"
  | "riskManager"
  | "quant"
  | "sysadmin"
  | "founder";

export const ROLES: { id: RoleId; th: string; sources: AlertSource[] | "all" }[] = [
  { id: "personal", th: "นักลงทุนรายบุคคล", sources: ["market"] },
  { id: "professional", th: "นักเทรดมืออาชีพ", sources: ["market", "execution"] },
  { id: "fundManager", th: "ผู้จัดการกองทุน", sources: ["market", "execution", "risk"] },
  { id: "riskManager", th: "ผู้จัดการความเสี่ยง", sources: ["risk", "execution", "market"] },
  { id: "quant", th: "นักพัฒนาเชิงปริมาณ", sources: ["ai", "backtest", "market"] },
  { id: "sysadmin", th: "ผู้ดูแลระบบ", sources: ["sysops", "exchange"] },
  { id: "founder", th: "ผู้ก่อตั้ง / ผู้ดูแลสูงสุด", sources: "all" },
];

export const GROUPS: { id: string; th: string; sources: AlertSource[]; minSeverity: Severity }[] = [
  { id: "trading", th: "ทีมเทรด", sources: ["market", "execution"], minSeverity: "medium" },
  { id: "risk", th: "ทีมความเสี่ยง", sources: ["risk"], minSeverity: "high" },
  { id: "devops", th: "ทีมดูแลระบบ", sources: ["sysops", "exchange"], minSeverity: "high" },
  { id: "exec", th: "ผู้บริหาร", sources: ["risk"], minSeverity: "critical" },
  { id: "quant", th: "ทีมวิเคราะห์เชิงปริมาณ", sources: ["ai", "backtest"], minSeverity: "medium" },
  { id: "security", th: "ทีมความปลอดภัย", sources: ["sysops"], minSeverity: "critical" },
];

export const DEFAULT_PREFS: Preferences = {
  channels: {
    inApp: { on: true, minSeverity: "info" },
    email: { on: true, minSeverity: "medium" },
    sms: { on: false, minSeverity: "critical" },
    telegram: { on: true, minSeverity: "high" },
    line: { on: false, minSeverity: "high" },
    webhook: { on: false, minSeverity: "high" },
  },
  frequency: "instant",
  dnd: { on: false, from: "22:00", to: "07:00" },
  thresholds: {},
  disabledRules: [],
  role: "founder",
};

/** Bangkok wall-clock minutes since midnight, for the quiet-hours window. */
function bkkMinutes(ts: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ts));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function inQuietHours(prefs: Preferences, ts: number): boolean {
  if (!prefs.dnd.on) return false;
  const now = bkkMinutes(ts);
  const from = toMinutes(prefs.dnd.from);
  const to = toMinutes(prefs.dnd.to);
  // A window that crosses midnight wraps around.
  return from <= to ? now >= from && now < to : now >= from || now < to;
}

/**
 * Folds this poll's detections into the existing alert list.
 *
 * A repeat of the same condition bumps `occurrences` instead of adding a row —
 * that is the deduplication the spec asks for. Anything that stops firing and
 * was not closed by a person is marked auto-resolved, which is what makes the
 * mean-time-to-resolve number meaningful.
 */
export function reduceAlerts(
  existing: Alert[],
  detections: Detection[],
  prefs: Preferences,
  now: number,
): Alert[] {
  const byKey = new Map(existing.map((a) => [a.dedupKey, a]));
  const firing = new Set(detections.map((d) => d.dedupKey));
  const quiet = inQuietHours(prefs, now);
  const freq = FREQUENCIES.find((f) => f.id === prefs.frequency)!;

  for (const d of detections) {
    const rule = RULE_BY_ID.get(d.ruleId);
    if (!rule) continue;
    const prev = byKey.get(d.dedupKey);

    if (prev) {
      const reopened = STATUS_META[prev.status].done;
      // Critical alerts always break through quiet hours.
      const mayResurface =
        freq.ms !== Infinity && now - prev.lastSeen >= freq.ms && (!quiet || d.severity === "critical");

      byKey.set(d.dedupKey, {
        ...prev,
        lastSeen: now,
        occurrences: prev.occurrences + 1,
        observed: d.observed,
        title: d.title,
        detail: d.detail,
        severity: d.severity,
        status: reopened ? "unread" : mayResurface && prev.status === "read" ? "unread" : prev.status,
        resolvedAt: reopened ? null : prev.resolvedAt,
        audit: reopened
          ? [...prev.audit, { time: now, actor: "Event Detection Engine", action: "REOPEN", detail: `เงื่อนไขกลับมาเกิดอีกครั้ง — ค่าที่วัดได้ ${d.observed}` }]
          : prev.audit,
      });
      continue;
    }

    const suppressed = quiet && d.severity !== "critical";
    byKey.set(d.dedupKey, {
      id: `${d.dedupKey}#${now}`,
      dedupKey: d.dedupKey,
      ruleId: d.ruleId,
      severity: d.severity,
      source: rule.source,
      kind: rule.kind,
      title: d.title,
      detail: d.detail,
      observed: d.observed,
      threshold: d.threshold,
      impact: d.impact,
      rootCause: d.rootCause,
      systemResponse: d.systemResponse,
      entity: d.entity,
      firstSeen: now,
      lastSeen: now,
      occurrences: 1,
      status: suppressed ? "read" : "unread",
      assignee: null,
      snoozeUntil: null,
      acknowledgedAt: null,
      resolvedAt: null,
      suppressedByDnd: suppressed,
      audit: [
        {
          time: now,
          actor: "Event Detection Engine",
          action: "DETECT",
          detail: `กฎ "${rule.th}" ทำงาน — ค่าที่วัดได้ ${d.observed} เทียบเกณฑ์ ${d.threshold}`,
        },
        ...(suppressed
          ? [
              {
                time: now,
                actor: "Notification Router",
                action: "SUPPRESS",
                detail: "อยู่ในช่วงห้ามรบกวน จึงไม่แจ้งเตือนแต่ยังบันทึกเหตุการณ์ไว้",
              },
            ]
          : []),
      ],
    });
  }

  // Conditions that stopped firing close themselves.
  for (const [key, a] of byKey) {
    if (firing.has(key) || STATUS_META[a.status].done) continue;
    byKey.set(key, {
      ...a,
      status: "autoResolved",
      resolvedAt: now,
      audit: [
        ...a.audit,
        {
          time: now,
          actor: "Event Detection Engine",
          action: "AUTO_RESOLVE",
          detail: "เงื่อนไขกลับสู่เกณฑ์ปกติแล้ว ระบบปิดเหตุการณ์เอง",
        },
      ],
    });
  }

  return [...byKey.values()].sort((a, b) => b.lastSeen - a.lastSeen);
}

export function evaluate(snapshot: Snapshot, prefs: Preferences): Detection[] {
  const out: Detection[] = [];
  for (const rule of RULES) {
    if (!rule.detect || prefs.disabledRules.includes(rule.id)) continue;
    const threshold = prefs.thresholds[rule.id] ?? rule.threshold;
    try {
      out.push(...rule.detect(snapshot, threshold));
    } catch {
      // A broken rule must never take the whole detector down.
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Views over the store
 * ------------------------------------------------------------------ */

export type TabId = "all" | "critical" | "high" | "general" | "done";

export const TABS: { id: TabId; th: string }[] = [
  { id: "all", th: "ทั้งหมด" },
  { id: "critical", th: "สำคัญเร่งด่วน" },
  { id: "high", th: "สำคัญ" },
  { id: "general", th: "ทั่วไป" },
  { id: "done", th: "ดำเนินการแล้ว" },
];

export function inTab(a: Alert, tab: TabId): boolean {
  if (tab === "all") return true;
  if (tab === "done") return STATUS_META[a.status].done;
  if (STATUS_META[a.status].done) return false;
  if (tab === "critical") return a.severity === "critical";
  if (tab === "high") return a.severity === "high";
  return a.severity === "medium" || a.severity === "low" || a.severity === "info";
}

export type AlertFilters = {
  severity: string;
  status: string;
  source: string;
  symbol: string;
  assignee: string;
  search: string;
  actionableOnly: boolean;
  autoResolvedOnly: boolean;
};

export const EMPTY_ALERT_FILTERS: AlertFilters = {
  severity: "all",
  status: "all",
  source: "all",
  symbol: "all",
  assignee: "all",
  search: "",
  actionableOnly: false,
  autoResolvedOnly: false,
};

export function visibleToRole(a: Alert, role: RoleId): boolean {
  const r = ROLES.find((x) => x.id === role);
  if (!r || r.sources === "all") return true;
  return r.sources.includes(a.source);
}

export function applyAlertFilters(alerts: Alert[], f: AlertFilters, now: number): Alert[] {
  const q = f.search.trim().toLowerCase();
  return alerts.filter((a) => {
    if (a.snoozeUntil && a.snoozeUntil > now) return false;
    if (f.severity !== "all" && a.severity !== f.severity) return false;
    if (f.status !== "all" && a.status !== f.status) return false;
    if (f.source !== "all" && a.source !== f.source) return false;
    if (f.symbol !== "all" && a.entity.symbol !== f.symbol) return false;
    if (f.assignee !== "all" && (a.assignee ?? "") !== f.assignee) return false;
    if (f.actionableOnly && (STATUS_META[a.status].done || a.severity === "info" || a.severity === "low"))
      return false;
    if (f.autoResolvedOnly && a.status !== "autoResolved") return false;
    if (q && !a.title.toLowerCase().includes(q) && !a.detail.toLowerCase().includes(q)) return false;
    return true;
  });
}

export type AlertStats = {
  total: number;
  critical: number;
  high: number;
  general: number;
  done: number;
  unread: number;
  /** Mean seconds from first detection to acknowledgement. */
  mtta: number | null;
  mttr: number | null;
  repeats: number;
  autoResolved: number;
  needsPerson: number;
};

export function stats(alerts: Alert[]): AlertStats {
  const open = alerts.filter((a) => !STATUS_META[a.status].done);
  const acked = alerts.filter((a) => a.acknowledgedAt !== null);
  const resolved = alerts.filter((a) => a.resolvedAt !== null);

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return {
    total: alerts.length,
    critical: open.filter((a) => a.severity === "critical").length,
    high: open.filter((a) => a.severity === "high").length,
    general: open.filter((a) => ["medium", "low", "info"].includes(a.severity)).length,
    done: alerts.filter((a) => STATUS_META[a.status].done).length,
    unread: alerts.filter((a) => a.status === "unread").length,
    mtta: mean(acked.map((a) => (a.acknowledgedAt! - a.firstSeen) / 1000)),
    mttr: mean(resolved.map((a) => (a.resolvedAt! - a.firstSeen) / 1000)),
    repeats: alerts.reduce((n, a) => n + Math.max(a.occurrences - 1, 0), 0),
    autoResolved: alerts.filter((a) => a.status === "autoResolved").length,
    needsPerson: open.filter((a) => a.severity === "critical" || a.severity === "high").length,
  };
}

/* ------------------------------------------------------------------ *
 * Actions offered on an alert
 * ------------------------------------------------------------------ */

export type AlertAction = {
  id: string;
  th: string;
  /** False when the platform genuinely cannot carry the action out. */
  available: boolean;
  reason?: string;
  /** Actions that move money ask for confirmation first. */
  confirm?: string;
  href?: string;
};

export function actionsFor(a: Alert): AlertAction[] {
  const blocked = "แพลตฟอร์มนี้ไม่รับ API Key และไม่ส่งคำสั่งไปยังกระดานเทรด จึงทำรายการนี้ไม่ได้";
  const list: AlertAction[] = [
    { id: "ack", th: "รับทราบเหตุการณ์", available: true },
    { id: "investigate", th: "เริ่มตรวจสอบ", available: true },
    { id: "resolve", th: "ปิดเหตุการณ์", available: true },
    { id: "snooze", th: "เลื่อนแจ้งเตือน 30 นาที", available: true },
    { id: "rule", th: "สร้างกฎอัตโนมัติจากเหตุการณ์นี้", available: true },
    { id: "source", th: `เปิดหน้า${SOURCE_META[a.source].th}`, available: true, href: SOURCE_META[a.source].href },
    { id: "export", th: "ส่งออกบันทึกเหตุการณ์", available: true },
  ];

  if (a.severity === "critical" || a.severity === "high") {
    list.push({
      id: "warroom",
      th: "เปิดห้องบัญชาการ",
      available: true,
      href: "/war-room",
    });
    list.push({
      id: "capital",
      th: "เปิดโหมดรักษาเงินทุน (หยุดฉุกเฉิน)",
      available: true,
      confirm:
        "จะพักบอททั้งหมดทันทีและไม่เปิดสถานะใหม่จนกว่าจะยกเลิก — มีผลกับทั้งแพลตฟอร์ม ยืนยันหรือไม่",
    });
  }

  if (a.source === "risk" || a.source === "execution") {
    list.push(
      { id: "reduce", th: "ลดความเสี่ยงของพอร์ต", available: false, reason: blocked },
      { id: "close", th: "ปิดสถานะทั้งหมด", available: false, reason: blocked },
      { id: "leverage", th: "ลด Leverage", available: false, reason: blocked },
      { id: "cancel", th: "ยกเลิกคำสั่งที่ค้างอยู่", available: false, reason: blocked },
    );
  }

  if (a.source === "exchange" || a.source === "sysops") {
    list.push(
      { id: "switch", th: "สลับไปกระดานสำรอง", available: false, reason: blocked },
      {
        id: "restart",
        th: "รีสตาร์ต API Gateway",
        available: false,
        reason: "ต้องมีสิทธิ์ควบคุมโครงสร้างพื้นฐานฝั่งเซิร์ฟเวอร์ ซึ่งหน้าเว็บไม่มี",
      },
    );
  }

  return list;
}

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */

const ISO = (ms: number) => new Date(ms).toISOString();

export function alertsToCsv(alerts: Alert[]): string {
  const head = [
    "id", "rule", "severity", "source", "status", "title", "observed",
    "threshold", "first_seen", "last_seen", "occurrences", "acknowledged_at",
    "resolved_at", "assignee", "symbol", "venue", "suppressed_by_dnd",
  ].join(",");
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;

  const rows = alerts.map((a) =>
    [
      a.id, a.ruleId, a.severity, a.source, a.status, esc(a.title), esc(a.observed),
      esc(a.threshold), ISO(a.firstSeen), ISO(a.lastSeen), a.occurrences,
      a.acknowledgedAt ? ISO(a.acknowledgedAt) : "",
      a.resolvedAt ? ISO(a.resolvedAt) : "",
      esc(a.assignee ?? ""), a.entity.symbol ?? "", esc(a.entity.venue ?? ""),
      a.suppressedByDnd ? "yes" : "no",
    ].join(","),
  );

  return [head, ...rows].join("\n");
}

export function eventLog(a: Alert): string {
  return [
    `NEXORA AITOS — Event Log`,
    `================================================`,
    `Event ID   : ${a.id}`,
    `Rule       : ${a.ruleId} (${RULE_BY_ID.get(a.ruleId)?.th ?? "—"})`,
    `Severity   : ${SEVERITY_META[a.severity].en}`,
    `Source     : ${SOURCE_META[a.source].en}`,
    `Status     : ${STATUS_META[a.status].th}`,
    `Observed   : ${a.observed}   (threshold ${a.threshold})`,
    `First seen : ${ISO(a.firstSeen)}`,
    `Last seen  : ${ISO(a.lastSeen)}`,
    `Occurrences: ${a.occurrences}`,
    ``,
    `Title      : ${a.title}`,
    `Detail     : ${a.detail}`,
    `Impact     : ${a.impact}`,
    `Root cause : ${a.rootCause}`,
    ``,
    `System response:`,
    ...a.systemResponse.map((r) => `  - ${r}`),
    ``,
    `Audit timeline:`,
    ...a.audit.map((s) => `  ${ISO(s.time)}  ${s.action.padEnd(13)} ${s.actor} — ${s.detail}`),
    ``,
    `Note: detections are computed from live public market and server data.`,
    `This platform holds no exchange API keys and submits no orders.`,
  ].join("\n");
}
