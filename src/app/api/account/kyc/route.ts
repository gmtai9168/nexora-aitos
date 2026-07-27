import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getKyc, submitKyc, toSummary, type KycSubmission } from "@/lib/server/kyc";

export const runtime = "nodejs";

const DOC_TYPES = ["id_card", "passport", "driver_license"];

async function email() {
  const s = await auth();
  return s?.user?.email?.toLowerCase() ?? null;
}

export async function GET() {
  const me = await email();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const sub = await getKyc(me);
  return NextResponse.json({ submission: sub ? toSummary(sub) : null });
}

export async function POST(req: Request) {
  const me = await email();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { fullName?: string; docType?: string; docNumber?: string; docImage?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const fullName = String(body.fullName ?? "").trim();
  const docNumber = String(body.docNumber ?? "").trim();
  const docType = String(body.docType ?? "") as KycSubmission["docType"];
  if (fullName.length < 2 || docNumber.length < 3 || !DOC_TYPES.includes(docType)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const sub = await submitKyc(me, { fullName, docType, docNumber, docImage: body.docImage });
  return NextResponse.json({ ok: true, submission: toSummary(sub) });
}
