import { NextResponse } from "next/server";
import { captureServerEvent } from "@/lib/posthog/server";

type Body = {
  lead?: string;
  niche?: string;
  source?: string;
  message?: string;
  owner?: string;
  deal_value?: number | string;
  distinct_id?: string;
};

/**
 * POST /api/posthog/lead-converted
 * Header: Authorization: Bearer $POSTHOG_LEAD_WEBHOOK_SECRET
 * Body: { lead, niche?, source?, message?, owner?, deal_value? }
 */
export async function POST(request: Request) {
  const secret = process.env.POSTHOG_LEAD_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook não configurado" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== secret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const lead = body.lead?.trim();
  if (!lead) {
    return NextResponse.json({ error: "lead é obrigatório" }, { status: 400 });
  }

  const distinctId =
    body.distinct_id?.trim() || `outbound:${lead}`;

  await captureServerEvent({
    distinctId,
    event: "deal_closed",
    properties: {
      lead,
      niche: body.niche?.trim() || undefined,
      source: body.source?.trim() || undefined,
      // "message" é bloqueado no sanitize (PHI) — usar outbound_message
      outbound_message: body.message?.trim() || undefined,
      owner: body.owner?.trim() || undefined,
      deal_value:
        body.deal_value !== undefined && body.deal_value !== ""
          ? Number(body.deal_value)
          : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
