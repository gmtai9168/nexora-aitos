/**
 * Package catalog. Pure data (client + server safe). Selecting a plan updates
 * the account's `plan` field — billing is a framework only: no real charge is
 * made until a payment provider (Stripe) is wired, and the UI says so plainly.
 */

export type PlanId = "free" | "plus" | "pro" | "enterprise";

export type Plan = {
  id: PlanId;
  name: string;
  priceTHB: number; // per month; 0 = free, -1 = "contact us"
  tagline: string;
  features: string[];
  /** Suggested RBAC role tier this plan pairs with (informational only). */
  suits: string;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceTHB: 0,
    tagline: "เริ่มต้นเรียนรู้กับ AI",
    suits: "Personal",
    features: [
      "แดชบอร์ดเรียลไทม์ (คริปโต/หุ้น)",
      "AI Council 50 ตัว (อ่านผลได้)",
      "เทรดจำลอง PAPER ไม่จำกัด",
      "แจ้งเตือนพื้นฐาน",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    priceTHB: 590,
    tagline: "สำหรับเทรดเดอร์จริงจัง",
    suits: "Pro Trader",
    features: [
      "ทุกอย่างใน Free",
      "AI เทรดอัตโนมัติ (PAPER) เต็มรูปแบบ",
      "ข่าวเชิงลึกจาก AI",
      "Backtest + สถิติรายเหรียญ",
      "แจ้งเตือนขั้นสูง",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceTHB: 1990,
    tagline: "ทีมเล็กและควอนต์",
    suits: "Company / Quant",
    features: [
      "ทุกอย่างใน Plus",
      "หลายผู้ใช้ในองค์กร (สูงสุด 10)",
      "เชื่อม Exchange (Trade-Only)",
      "Risk Desk + War Room",
      "API สำหรับกลยุทธ์ของคุณเอง",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceTHB: -1,
    tagline: "กองทุน/สถาบัน",
    suits: "Fund / Institution",
    features: [
      "ทุกอย่างใน Pro",
      "ผู้ใช้ไม่จำกัด + สิทธิ์ละเอียด",
      "SLA + ผู้ดูแลเฉพาะทาง",
      "รายงานผู้บริหาร + Compliance",
      "ปรับแต่งเฉพาะองค์กร",
    ],
  },
];

export function planById(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function priceLabel(p: Plan): string {
  if (p.priceTHB === 0) return "ฟรี";
  if (p.priceTHB < 0) return "ติดต่อทีมงาน";
  return `฿${p.priceTHB.toLocaleString()}/เดือน`;
}
