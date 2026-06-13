import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMemberWithRole } from "@/lib/auth-helpers";
import { createTranscriptionJob } from "@/lib/transcribe-api";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_ROLES = new Set(["medico", "admin", "secretaria"]);

async function validateAppointmentAccess(appointmentId: string, clinicId: string) {
  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  return appointment != null;
}

/**
 * POST /api/appointments/[id]/transcribe
 * Recebe áudio gravado no atendimento e inicia job na API externa.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params;
    const { id: userId, clinicId, role } = await requireClinicMemberWithRole();

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Sem permissão para transcrever áudio." }, { status: 403 });
    }

    const hasAccess = await validateAppointmentAccess(appointmentId, clinicId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Nenhum arquivo de áudio enviado." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Tamanho máximo: 50 MB." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Arquivo de áudio vazio." }, { status: 400 });
    }

    const filename =
      file instanceof File && file.name ? file.name : "recording.webm";
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = await createClient();
    const { data: row, error: insertError } = await supabase
      .from("appointment_transcriptions")
      .insert({
        appointment_id: appointmentId,
        clinic_id: clinicId,
        created_by: userId,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertError || !row) {
      console.error("[Transcribe] insert error:", insertError);
      return NextResponse.json({ error: "Erro ao registrar transcrição." }, { status: 500 });
    }

    try {
      const jobId = await createTranscriptionJob(buffer, filename, clinicId, "recording");

      const { error: updateError } = await supabase
        .from("appointment_transcriptions")
        .update({
          external_job_id: jobId,
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) {
        console.error("[Transcribe] update job_id error:", updateError);
      }

      return NextResponse.json({
        transcriptionId: row.id,
        status: "processing",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao iniciar transcrição.";
      await supabase
        .from("appointment_transcriptions")
        .update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      return NextResponse.json({ error: message }, { status: 502 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    const status = message === "Não autenticado" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
