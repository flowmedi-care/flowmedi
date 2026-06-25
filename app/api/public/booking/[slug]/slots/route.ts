import { NextRequest, NextResponse } from "next/server";
import { findAvailableSlots } from "@/lib/appointment-conflicts";
import { resolvePublicBookingContext } from "@/lib/public-site/api-helpers";
import { checkRateLimit } from "@/lib/public-site/rate-limit";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = checkRateLimit(`slots:${slug}:${ip}`, 40);
  if (!rate.ok) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente." }, { status: 429 });
  }

  const procedureId = request.nextUrl.searchParams.get("procedureId");
  const doctorId = request.nextUrl.searchParams.get("doctorId");

  if (!procedureId || !doctorId) {
    return NextResponse.json({ error: "procedureId e doctorId são obrigatórios." }, { status: 400 });
  }

  const ctx = await resolvePublicBookingContext(slug);
  if (ctx.error || !ctx.site) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const procedure = ctx.site.procedures.find((p) => p.id === procedureId);
  const doctor = ctx.site.doctors.find((d) => d.id === doctorId);

  if (!procedure) {
    return NextResponse.json({ error: "Procedimento inválido." }, { status: 400 });
  }
  if (!doctor) {
    return NextResponse.json({ error: "Profissional inválido." }, { status: 400 });
  }

  if (procedure.doctor_ids.length > 0 && !procedure.doctor_ids.includes(doctorId)) {
    return NextResponse.json({ error: "Profissional não atende este procedimento." }, { status: 400 });
  }

  const slots = await findAvailableSlots(ctx.supabase, {
    clinicId: ctx.site.clinic_id,
    doctorId,
    procedureId,
  });

  return NextResponse.json({ slots });
}
