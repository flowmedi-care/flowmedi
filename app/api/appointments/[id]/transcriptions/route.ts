import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMemberWithRole } from "@/lib/auth-helpers";

/**
 * GET /api/appointments/[id]/transcriptions
 * Lista transcrições do atendimento (histórico).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params;
    const { clinicId } = await requireClinicMemberWithRole();

    const supabase = await createClient();

    const { data: appointment } = await supabase
      .from("appointments")
      .select("id")
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (!appointment) {
      return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("appointment_transcriptions")
      .select(
        "id, status, transcript, error_message, duration_seconds, processing_time_seconds, created_at, completed_at"
      )
      .eq("appointment_id", appointmentId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Transcribe] list error:", error);
      return NextResponse.json({ error: "Erro ao carregar transcrições." }, { status: 500 });
    }

    return NextResponse.json({ transcriptions: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    const status = message === "Não autenticado" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
