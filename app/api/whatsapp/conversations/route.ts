import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";

/**
 * Lista conversas WhatsApp da clínica
 * GET /api/whatsapp/conversations
 */
export async function GET(request: NextRequest) {
  try {
    const member = await requireClinicMember();
    const supabase = await createClient();

    const { data: conversations, error } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("clinic_id", member.clinicId)
      .eq("is_archived", false)
      .order("last_message_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ conversations: conversations || [] });
  } catch (error) {
    console.error("Erro ao listar conversas:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar conversas" },
      { status: 500 }
    );
  }
}
