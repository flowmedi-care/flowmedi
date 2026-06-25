import { NextRequest, NextResponse } from "next/server";
import { resolvePublicBookingContext } from "@/lib/public-site/api-helpers";
import { checkRateLimit } from "@/lib/public-site/rate-limit";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = checkRateLimit(`catalog:${slug}:${ip}`, 60);
  if (!rate.ok) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente." }, { status: 429 });
  }

  const ctx = await resolvePublicBookingContext(slug);
  if (ctx.error || !ctx.site) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  return NextResponse.json({
    doctors: ctx.site.doctors.map((d) => ({
      id: d.id,
      full_name: d.full_name,
      specialty: d.specialty,
    })),
    procedures: ctx.site.procedures.map((p) => ({
      id: p.id,
      name: p.name,
      duration_minutes: p.duration_minutes,
      doctor_ids: p.doctor_ids,
    })),
  });
}
