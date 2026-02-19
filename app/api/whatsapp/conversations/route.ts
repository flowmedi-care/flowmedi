import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";

/**
 * GET /api/whatsapp/conversations
 * Lista conversas WhatsApp da clínica (usa tabelas whatsapp_conversations / whatsapp_messages).
 */
export async function GET() {
  try {
    const { clinicId } = await requireClinicMember();
    const supabase = await createClient();

    const { data: conversations, error } = await supabase
      .from("whatsapp_conversations")
      .select("id, phone_number, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

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
