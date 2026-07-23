import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "การตั้งค่า · AI TRADING HUB" };

export default function Page() {
  return <ComingSoon th="การตั้งค่า" en="Settings" points={["เชื่อมต่อ API Key ของ Exchange", "ตั้งค่าสกุลเงินอ้างอิงและเขตเวลา", "จัดการผู้ใช้และสิทธิ์การเข้าถึง"]} />;
}
