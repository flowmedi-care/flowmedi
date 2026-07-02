import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { checkRateLimit } from "@/lib/public-site/rate-limit";
import { computeDsarDueAt, getDsarSlaTier } from "@/lib/compliance/dsar-sla";

export const dynamic = "force-dynamic";

type SubmitBody = {
  clinic_slug?: string;
  request_type?: string;
  requester_name?: string;
  requester_email?: string;
  requester_phone?: string;
  notes?: string;
};

const VALID_TYPES = new Set([
  "access",
  "correction",
  "deletion",
  "portability",
  "opposition",
  "other",
]);

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = checkRateLimit(`public-dsar:${ip}`, 5, 600_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Limite de solicitações atingido. Tente mais tarde." },
      { status: 429 }
    );
  }

  let body: SubmitBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const clinicSlug = body.clinic_slug?.trim().toLowerCase();
  const requestType = body.request_type?.trim() ?? "access";
  const requesterName = body.requester_name?.trim();
  const requesterEmail = body.requester_email?.trim();

  if (!clinicSlug) {
    return NextResponse.json({ error: "Identificador da clínica é obrigatório." }, { status: 400 });
  }
  if (!requesterName) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }
  if (!requesterEmail) {
    return NextResponse.json({ error: "E-mail é obrigatório." }, { status: 400 });
  }
  if (!VALID_TYPES.has(requestType)) {
    return NextResponse.json({ error: "Tipo de solicitação inválido." }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const supabase = createServiceRoleClient();
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("id, name")
    .eq("slug", clinicSlug)
    .single();

  if (clinicError || !clinic) {
    return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });
  }

  const createdAt = new Date();
  const dueAt = computeDsarDueAt(requestType, createdAt);
  const slaTier = getDsarSlaTier(requestType);

  const { error: insertError } = await supabase.from("data_subject_requests").insert({
    clinic_id: clinic.id,
    request_type: requestType,
    requester_name: requesterName,
    requester_email: requesterEmail,
    requester_phone: body.requester_phone?.trim() || null,
    notes: body.notes?.trim() || null,
    status: "open",
    source: "public_portal",
    due_at: dueAt.toISOString(),
    sla_tier: slaTier,
    created_at: createdAt.toISOString(),
  });

  if (insertError) {
    console.error("[public/dsar/submit]", insertError);
    return NextResponse.json({ error: "Erro ao registrar solicitação." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message:
      "Solicitação registrada. A clínica controladora entrará em contato conforme prazos da LGPD.",
    due_at: dueAt.toISOString(),
    clinic_name: clinic.name,
  });
}
