import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "แบ็คเทสต์ · AI TRADING HUB" };

export default function Page() {
  return <ComingSoon th="แบ็คเทสต์" en="Backtesting" points={["ทดสอบกลยุทธ์กับข้อมูลย้อนหลัง", "ดู Equity Curve, Max Drawdown และ Win Rate", "เปรียบเทียบผลหลายกลยุทธ์พร้อมกัน"]} />;
}
