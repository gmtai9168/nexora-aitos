import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getConnections,
  saveConnection,
  removeConnection,
  toPublicConnection,
  type ExchangeId,
} from "@/lib/server/exchange-keys";
import { encryptionAvailable } from "@/lib/server/crypto-box";

export const runtime = "nodejs";

const EXCHANGES: ExchangeId[] = ["binance", "bybit", "okx"];

async function requireEmail() {
  const session = await auth();
  return session?.user?.email ?? null;
}

export async function GET() {
  const email = await requireEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const list = await getConnections(email);
  return NextResponse.json({
    connections: list.map(toPublicConnection),
    canStore: encryptionAvailable(),
    // Truthful reminder that connecting keys does not turn on real trading.
    liveTrading: false,
  });
}

export async function POST(req: Request) {
  const email = await requireEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // Refuse to persist a secret we cannot encrypt.
  if (!encryptionAvailable()) {
    return NextResponse.json({ error: "encryption_unavailable" }, { status: 503 });
  }

  let body: { exchange?: string; apiKey?: string; secret?: string; scope?: string; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const exchange = String(body.exchange ?? "") as ExchangeId;
  const apiKey = String(body.apiKey ?? "").trim();
  const secret = String(body.secret ?? "").trim();
  if (!EXCHANGES.includes(exchange) || apiKey.length < 8 || secret.length < 8) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const scope = body.scope === "read-only" ? "read-only" : "trade-only";
  const conn = await saveConnection(email, { exchange, apiKey, secret, scope, label: body.label?.slice(0, 40) });
  return NextResponse.json({ ok: true, connection: toPublicConnection(conn), liveTrading: false });
}

export async function DELETE(req: Request) {
  const email = await requireEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const exchange = String(searchParams.get("exchange") ?? "") as ExchangeId;
  if (!EXCHANGES.includes(exchange)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  await removeConnection(email, exchange);
  return NextResponse.json({ ok: true });
}
