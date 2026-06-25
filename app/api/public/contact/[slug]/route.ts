import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { checkRateLimit } from "@/lib/public-site/rate-limit";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = checkRateLimit(`contact:${slug}:${ip}`, 5, 300_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Limite de envios atingido. Tente mais tarde." },
      { status: 429 }
    );
  }

  let body: { name?: string; phone?: string; email?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const phone = body.phone?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: "E-mail é obrigatório." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("submit_public_site_contact", {
    p_slug: slug,
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_message: message,
  });

  if (error) {
    return NextResponse.json({ error: "Erro ao enviar mensagem." }, { status: 500 });
  }

  const result = data as { success?: boolean; error?: string };
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Erro ao enviar mensagem." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
