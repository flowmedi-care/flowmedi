import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";

/**
 * GET /api/whatsapp/conversations?status=open|closed|completed
 * Lista conversas WhatsApp da clínica (usa tabelas whatsapp_conversations / whatsapp_messages).
 * Se status não for fornecido, retorna todas.
 */
export async function GET(request: Request) {
  try {
    const { clinicId } = await requireClinicMember();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("whatsapp_conversations")
      .select("id, phone_number, contact_name, status, last_inbound_message_at, created_at")
      .eq("clinic_id", clinicId);

    if (status && ["open", "closed", "completed"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data: conversations, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(conversations || []);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar conversas";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
