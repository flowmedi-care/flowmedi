import { NextRequest, NextResponse } from "next/server";
import { requireClinicalTranscriptionAccess, requireTranscriptionOwnership } from "@/lib/clinical-transcription/access";
import { parseTranscriptSegments } from "@/lib/clinical-transcription/types";

/**
 * PATCH /api/appointments/[id]/transcriptions/[tid]/live
 * Backup periódico do texto ao vivo durante streaming.
 */
export async function PATCH(
  request: NextRequest,
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
      return NextResponse.json({ error: "Transcrição não pertence a esta consulta." }, { status: 400 });
    }

    const body = (await request.json()) as {
      liveTranscript?: string;
      transcriptSegments?: unknown;
      recordingDurationSeconds?: number;
    };

    const liveTranscript = body.liveTranscript?.trim();
    const segments = parseTranscriptSegments(body.transcriptSegments);

    if (!liveTranscript && !segments?.length) {
      return NextResponse.json({ error: "Nenhum conteúdo para salvar." }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (liveTranscript) {
      updatePayload.live_transcript = liveTranscript;
    }
    if (segments) {
      updatePayload.transcript_segments = segments;
    }
    if (
      typeof body.recordingDurationSeconds === "number" &&
      Number.isFinite(body.recordingDurationSeconds)
    ) {
      updatePayload.duration_seconds = body.recordingDurationSeconds;
    }

    const { error } = await owned.supabase
      .from("appointment_transcriptions")
      .update(updatePayload)
      .eq("id", transcriptionId);

    if (error) {
      console.error("[TranscribeStream] live patch error:", error);
      return NextResponse.json({ error: "Erro ao salvar transcrição ao vivo." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    const status = message === "Não autenticado" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
