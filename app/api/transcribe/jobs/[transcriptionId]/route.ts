import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMemberWithRole } from "@/lib/auth-helpers";
import { isClinicalPostProcessingEnabled } from "@/lib/clinical-transcription/feature-flags";
import { runClinicalPostProcessing } from "@/lib/clinical-transcription/post-process";
import { getTranscriptionJob, type JobStatus } from "@/lib/transcribe-api";

function mapExternalStatus(status: JobStatus): JobStatus {
  if (status === "queued") return "processing";
  return status;
}

/**
 * GET /api/transcribe/jobs/[transcriptionId]
 * Consulta status da transcrição (poll externo + persistência no DB).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ transcriptionId: string }> }
) {
  try {
    const { transcriptionId } = await params;
    const { clinicId } = await requireClinicMemberWithRole();

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("appointment_transcriptions")
      .select(
        "id, clinic_id, external_job_id, status, transcription_mode, transcript, live_transcript, error_message, duration_seconds, processing_time_seconds, post_processing_status"
      )
      .eq("id", transcriptionId)
      .maybeSingle();

    if (error) {
      console.error("[Transcribe] fetch row error:", error);
      return NextResponse.json({ error: "Erro ao consultar transcrição." }, { status: 500 });
    }

    if (!row || row.clinic_id !== clinicId) {
      return NextResponse.json({ error: "Transcrição não encontrada." }, { status: 404 });
    }

    if (row.status === "completed" || row.status === "failed") {
      return NextResponse.json({
        status: row.status,
        transcript: row.transcript,
        live_transcript: row.live_transcript,
        error_message: row.error_message,
        duration_seconds: row.duration_seconds,
        processing_time_seconds: row.processing_time_seconds,
        post_processing_status: row.post_processing_status,
      });
    }

    if (row.status === "streaming" || row.transcription_mode === "streaming") {
      return NextResponse.json({
        status: row.status,
        transcript: row.transcript,
        live_transcript: row.live_transcript,
        error_message: row.error_message,
        duration_seconds: row.duration_seconds,
        processing_time_seconds: row.processing_time_seconds,
        post_processing_status: row.post_processing_status,
      });
    }

    if (!row.external_job_id) {
      return NextResponse.json({
        status: row.status,
        transcript: null,
        error_message: row.error_message,
      });
    }

    try {
      const job = await getTranscriptionJob(row.external_job_id);
      const mappedStatus = mapExternalStatus(job.status);

      console.info("[Transcribe] poll job", {
        transcriptionId,
        external_job_id: row.external_job_id,
        status: job.status,
        mappedStatus,
      });

      if (mappedStatus === "completed") {
        const transcript = (job.text ?? "").trim();
        const isHybrid = row.transcription_mode === "hybrid";
        const postProcessingStatus =
          isHybrid && isClinicalPostProcessingEnabled()
            ? "pending"
            : isHybrid
              ? "skipped"
              : row.post_processing_status;

        const updatePayload = {
          status: transcript ? (isHybrid && isClinicalPostProcessingEnabled() ? "processing" : "completed") : "failed",
          transcript: transcript || null,
          error_message: transcript ? null : "Transcrição concluída, mas o texto está vazio.",
          duration_seconds: job.duration_seconds ?? null,
          processing_time_seconds: job.processing_time_seconds ?? null,
          post_processing_status: postProcessingStatus,
          updated_at: new Date().toISOString(),
          completed_at: isHybrid && isClinicalPostProcessingEnabled() ? null : new Date().toISOString(),
        };

        await supabase
          .from("appointment_transcriptions")
          .update(updatePayload)
          .eq("id", transcriptionId);

        if (isHybrid && isClinicalPostProcessingEnabled() && transcript) {
          waitUntil(runClinicalPostProcessing(transcriptionId));
        }

        return NextResponse.json({
          status: updatePayload.status,
          transcript: updatePayload.transcript,
          error_message: updatePayload.error_message,
          duration_seconds: updatePayload.duration_seconds,
          processing_time_seconds: updatePayload.processing_time_seconds,
          post_processing_status: postProcessingStatus,
        });
      }

      if (mappedStatus === "failed") {
        const errorMessage = job.error_message || "Transcrição falhou.";
        await supabase
          .from("appointment_transcriptions")
          .update({
            status: "failed",
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          .eq("id", transcriptionId);

        return NextResponse.json({
          status: "failed",
          transcript: null,
          error_message: errorMessage,
        });
      }

      if (row.status !== mappedStatus) {
        await supabase
          .from("appointment_transcriptions")
          .update({
            status: mappedStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transcriptionId);
      }

      return NextResponse.json({
        status: mappedStatus,
        transcript: null,
        error_message: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao consultar transcrição.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    const status = message === "Não autenticado" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
