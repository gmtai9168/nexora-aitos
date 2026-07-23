import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "การแจ้งเตือน · AI TRADING HUB" };

export default function Page() {
  return <ComingSoon th="การแจ้งเตือน" en="Alerts" points={["ตั้งเตือนเมื่อราคาแตะระดับที่กำหนด", "เตือนเมื่อ Funding Rate หรือ RSI ผิดปกติ", "ส่งแจ้งเตือนเข้าไลน์หรืออีเมล"]} />;
}
