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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * POST /api/appointments/[id]/transcribe
 * Recebe áudio gravado no atendimento e inicia job na API externa.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log: string[] = [];

  try {
    const { id: appointmentId } = await params;
    const { id: userId, clinicId, role } = await requireClinicMemberWithRole();
    log.push(`Autenticado (${role}).`);

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        { error: "Sem permissão para transcrever áudio.", log },
        { status: 403 }
      );
    }

    const hasAccess = await validateAppointmentAccess(appointmentId, clinicId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Consulta não encontrada.", log }, { status: 404 });
    }
    log.push("Consulta validada.");

    const formData = await request.formData();
    const file = formData.get("file");
    const recordingDurationRaw = formData.get("recording_duration_seconds");
    const recordingDurationSeconds =
      typeof recordingDurationRaw === "string" && recordingDurationRaw.trim()
        ? Number.parseFloat(recordingDurationRaw)
        : null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Nenhum arquivo de áudio enviado.", log }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    log.push(
      `Áudio recebido: ${formatBytes(file.size)}, tipo ${mimeType}` +
        (recordingDurationSeconds != null && Number.isFinite(recordingDurationSeconds)
          ? `, duração informada ${Math.round(recordingDurationSeconds)}s`
          : "")
    );

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Tamanho máximo: 50 MB.", log },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Arquivo de áudio vazio.", log }, { status: 400 });
    }

    if (
      recordingDurationSeconds != null &&
      Number.isFinite(recordingDurationSeconds) &&
      recordingDurationSeconds < 1
    ) {
      return NextResponse.json(
        {
          error: "Gravação muito curta. Fale por pelo menos 1 segundo antes de parar.",
          log,
        },
        { status: 400 }
      );
    }

    const filename =
      file instanceof File && file.name ? file.name : "recording.webm";
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = await createClient();
    log.push("Registrando transcrição no banco…");

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
      log.push("Falha ao registrar no banco.");
      return NextResponse.json({ error: "Erro ao registrar transcrição.", log }, { status: 500 });
    }

    log.push(`Registro criado (${row.id.slice(0, 8)}…).`);

    try {
      log.push("Enviando para API de transcrição…");
      console.info("[Transcribe] POST route", {
        appointmentId,
        transcriptionId: row.id,
        clinicId,
        userId,
        filename,
        mimeType,
        bytes: buffer.byteLength,
        recordingDurationSeconds,
      });

      const jobId = await createTranscriptionJob(buffer, filename, clinicId, "recording", {
        mimeType,
        recordingDurationSeconds:
          recordingDurationSeconds != null && Number.isFinite(recordingDurationSeconds)
            ? recordingDurationSeconds
            : undefined,
      });

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
        log.push("Aviso: job criado, mas falhou ao salvar job_id no banco.");
      } else {
        log.push(`Job criado na API (${jobId.slice(0, 8)}…).`);
      }

      return NextResponse.json({
        transcriptionId: row.id,
        status: "processing",
        jobId,
        log,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao iniciar transcrição.";
      console.error("[Transcribe] create job error:", {
        transcriptionId: row.id,
        message,
        filename,
        mimeType,
        bytes: buffer.byteLength,
        recordingDurationSeconds,
      });

      log.push(`Erro na API de transcrição: ${message}`);

      await supabase
        .from("appointment_transcriptions")
        .update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      return NextResponse.json({ error: message, log }, { status: 502 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    log.push(`Erro interno: ${message}`);
    const status = message === "Não autenticado" ? 401 : 500;
    return NextResponse.json({ error: message, log }, { status });
  }
}
