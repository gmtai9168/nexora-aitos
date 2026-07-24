import { EMPTY_MEMORY, type AiMemory } from "@/lib/ai-memory";
import { kvConfigured, kvGetJson, kvPing } from "@/lib/server/kv";

export const maxDuration = 15;

const MEMORY_KEY = "nexora:ai-memory:v1";

/** Is the central memory store connected, and what does it hold. */
export async function GET() {
  const configured = kvConfigured();
  if (!configured) {
    return Response.json(
      { configured: false, reachable: false, totalClosed: 0, message: "ยังไม่ได้เชื่อม Vercel KV" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const reachable = await kvPing();
  const mem = reachable ? (await kvGetJson<AiMemory>(MEMORY_KEY)) ?? EMPTY_MEMORY : EMPTY_MEMORY;

  return Response.json(
    {
      configured: true,
      reachable,
      totalClosed: mem.totalClosed,
      totalWins: mem.totalWins,
      buckets: Object.keys(mem.stats).length,
      message: reachable ? "เชื่อม KV สำเร็จ — ความจำเก็บกลางถาวร" : "ตั้งค่าแล้วแต่ติดต่อ KV ไม่ได้",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
