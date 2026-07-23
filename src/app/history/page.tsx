import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "ประวัติการเทรด · AI TRADING HUB" };

export default function Page() {
  return <ComingSoon th="ประวัติการเทรด" en="Trade History" points={["รายการซื้อขายทั้งหมดพร้อมกำไร/ขาดทุนต่อไม้", "กรองตามเหรียญ ช่วงเวลา และบอท", "ส่งออกเป็นไฟล์ CSV สำหรับทำบัญชี"]} />;
}
