import { NextRequest, NextResponse } from "next/server";
import { createAppointmentViaAssistant } from "@/lib/virtual-assistant/services/appointments";
import { registerPatientViaAssistant } from "@/lib/virtual-assistant/services/patients";
import { resolvePublicBookingContext } from "@/lib/public-site/api-helpers";
import { checkRateLimit } from "@/lib/public-site/rate-limit";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = checkRateLimit(`book:${slug}:${ip}`, 10, 300_000);
  if (!rate.ok) {
    return NextResponse.json({ error: "Limite de agendamentos atingido. Tente mais tarde." }, { status: 429 });
  }

  let body: {
    procedureId?: string;
    doctorId?: string;
    scheduledAt?: string;
    fullName?: string;
    phone?: string;
    email?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const { procedureId, doctorId, scheduledAt, fullName, phone, email } = body;

  if (!procedureId || !doctorId || !scheduledAt || !fullName?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }

  const ctx = await resolvePublicBookingContext(slug);
  if (ctx.error || !ctx.site) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const procedure = ctx.site.procedures.find((p) => p.id === procedureId);
  const doctor = ctx.site.doctors.find((d) => d.id === doctorId);

  if (!procedure || !doctor) {
    return NextResponse.json({ error: "Procedimento ou profissional inválido." }, { status: 400 });
  }

  if (procedure.doctor_ids.length > 0 && !procedure.doctor_ids.includes(doctorId)) {
    return NextResponse.json({ error: "Profissional não atende este procedimento." }, { status: 400 });
  }

  const patientRes = await registerPatientViaAssistant(ctx.supabase, ctx.site.clinic_id, {
    full_name: fullName.trim(),
    phone: phone.trim(),
    email: email ?? null,
  });

  if (patientRes.error || !patientRes.patientId) {
    return NextResponse.json({ error: patientRes.error ?? "Erro ao cadastrar paciente." }, { status: 400 });
  }

  const apptRes = await createAppointmentViaAssistant(ctx.supabase, {
    clinicId: ctx.site.clinic_id,
    patientId: patientRes.patientId,
    doctorId,
    procedureId,
    scheduledAt,
  });

  if (apptRes.error || !apptRes.appointmentId) {
    return NextResponse.json({ error: apptRes.error ?? "Erro ao agendar." }, { status: 400 });
  }

  try {
    await ctx.supabase.rpc("create_event_timeline", {
      p_clinic_id: ctx.site.clinic_id,
      p_event_code: "appointment_created",
      p_patient_id: patientRes.patientId,
      p_appointment_id: apptRes.appointmentId,
      p_metadata: { source: "public_site" },
    });
  } catch {
    // timeline opcional
  }

  return NextResponse.json({ appointmentId: apptRes.appointmentId });
}
