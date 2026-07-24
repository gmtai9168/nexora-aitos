import { account, isConfigured, serverTime } from "@/lib/server/binance-testnet";
import type { TestnetStatus } from "@/lib/testnet";

export const maxDuration = 20;

/** Connection health: is a key present, is testnet reachable, and can it trade. */
export async function GET() {
  const configured = isConfigured();
  const started = Date.now();
  const time = await serverTime();
  const latencyMs = Date.now() - started;

  let canTrade: boolean | null = null;
  let message = "";
  let clockSkewMs: number | null = null;

  if (time.ok) {
    clockSkewMs = time.data.serverTime - Date.now();
  }

  if (!configured) {
    message = "ยังไม่ได้ตั้งค่า API Key ของ Testnet บนเซิร์ฟเวอร์";
  } else if (!time.ok) {
    message = `เชื่อมต่อ Testnet ไม่สำเร็จ: ${time.message}`;
  } else {
    const acc = await account();
    if (acc.ok) {
      canTrade = acc.data.canTrade;
      message = "เชื่อมต่อ Testnet สำเร็จ พร้อมใช้งาน";
    } else {
      message = `คีย์ไม่ถูกต้องหรือไม่มีสิทธิ์: ${acc.message}`;
    }
  }

  const status: TestnetStatus = {
    configured,
    reachable: time.ok,
    latencyMs,
    clockSkewMs,
    canTrade,
    message,
  };

  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}
