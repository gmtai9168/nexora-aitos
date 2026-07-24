import { DEFAULT_AI_CONFIG, sanitizeConfig, type AiTraderConfig } from "@/lib/ai-trader";
import { getControl, setControl } from "@/lib/server/ai-orchestrator";

export const maxDuration = 15;

/** Read the server-side armed flag, config and recent run log. */
export async function GET() {
  const state = await getControl();
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}

/** Arm/disarm the 24/7 trader and store the config the scheduler will use. */
export async function POST(request: Request) {
  let body: { enabled?: boolean; config?: Partial<AiTraderConfig> };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const patch: { enabled?: boolean; config?: AiTraderConfig } = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (body.config) patch.config = sanitizeConfig({ ...DEFAULT_AI_CONFIG, ...body.config });

  const ok = await setControl(patch);
  if (!ok) {
    return Response.json(
      { ok: false, message: "ต้องเชื่อม Vercel KV ก่อนจึงจะเปิดโหมด 24 ชม.ได้" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  const state = await getControl();
  return Response.json({ ok: true, ...state }, { headers: { "Cache-Control": "no-store" } });
}
