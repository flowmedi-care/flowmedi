import { NextRequest, NextResponse } from "next/server";
import { requireClinicalTranscriptionAccess, requireTranscriptionOwnership } from "@/lib/clinical-transcription/access";
import {
  parseClinicalSummary,
  parseDialogue,
  parseTranscriptSegments,
} from "@/lib/clinical-transcription/types";

/**
 * GET /api/appointments/[id]/transcriptions/[tid]
 * Detalhe completo da transcrição (live, diálogo, resumo).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; tid: string }> }
) {
  try {
    const { id: appointmentId, tid: transcriptionId } = await params;
    const access = await requireClinicalTranscriptionAccess(appointmentId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const owned = await requireTranscriptionOwnership(transcriptionId, access.clinicId);
    if (!owned.ok) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }

    if (owned.row.appointment_id !== appointmentId) {
      return NextResponse.json({ error: "Transcrição não pertence a esta consulta." }, { status: 404 });
    }

    const row = owned.row;

    return NextResponse.json({
      id: row.id,
      status: row.status,
      transcription_mode: row.transcription_mode ?? "batch",
      transcript: row.transcript,
      live_transcript: row.live_transcript,
      transcript_segments: parseTranscriptSegments(row.transcript_segments),
      dialogue: parseDialogue(row.dialogue),
      clinical_summary: parseClinicalSummary(row.clinical_summary),
      post_processing_status: row.post_processing_status,
      post_processing_error: row.post_processing_error,
      stream_session_id: row.stream_session_id,
      error_message: row.error_message,
      duration_seconds: row.duration_seconds,
      processing_time_seconds: row.processing_time_seconds,
      created_at: row.created_at,
      completed_at: row.completed_at,
      summarized_at: row.summarized_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    const status = message === "Não autenticado" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
