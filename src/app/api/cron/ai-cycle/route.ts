import { runScheduledCycle } from "@/lib/server/ai-orchestrator";

export const maxDuration = 60;

/**
 * The scheduled trigger — call this on a timer (Vercel Cron or an external
 * scheduler) to keep the AI trading and learning with no browser open.
 *
 * It does nothing unless the trader is armed in KV, so it is safe to call
 * often. When CRON_SECRET is set it must be presented, either as the Vercel
 * Cron `Authorization: Bearer` header or a `?key=` query param; without the
 * env var the endpoint relies on the armed flag alone.
 */
async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const auth = request.headers.get("authorization");
    const key = url.searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return Response.json({ ok: false, message: "unauthorized" }, { status: 401 });
    }
  }

  const result = await runScheduledCycle();
  return Response.json(
    {
      ok: true,
      ran: result.ran,
      reason: result.reason,
      summary: result.report
        ? {
            opened: result.report.opened,
            closed: result.report.closed,
            openPositions: result.report.openPositions,
            balance: result.report.balance,
            message: result.report.message,
          }
        : null,
      at: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = handle;
export const POST = handle;
