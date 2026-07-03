import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { requireClinicalTranscriptionAccess, requireTranscriptionOwnership } from "@/lib/clinical-transcription/access";
import {
  isClinicalPostProcessingEnabled,
  isClinicalStreamingEnabled,
} from "@/lib/clinical-transcription/feature-flags";
import { runClinicalPostProcessing } from "@/lib/clinical-transcription/post-process";
import { getStreamSessionArtifact } from "@/lib/transcribe-stream-api";
import { parseTranscriptSegments } from "@/lib/clinical-transcription/types";

/**
 * POST /api/appointments/[id]/transcribe/stream/finalize
 * Finaliza sessão de streaming e dispara pós-processamento clínico.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log: string[] = [];

  try {
    if (!isClinicalStreamingEnabled()) {
      return NextResponse.json(
        { error: "Transcrição em tempo real não está habilitada.", log },
        { status: 403 }
      );
    }

    const { id: appointmentId } = await params;
    const access = await requireClinicalTranscriptionAccess(appointmentId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error, log }, { status: access.status });
    }

    const body = (await request.json()) as {
      transcriptionId?: string;
      recordingDurationSeconds?: number;
      liveTranscript?: string;
      transcriptSegments?: unknown;
    };

    if (!body.transcriptionId) {
      return NextResponse.json({ error: "transcriptionId é obrigatório.", log }, { status: 400 });
    }

    const owned = await requireTranscriptionOwnership(body.transcriptionId, access.clinicId);
    if (!owned.ok) {
      return NextResponse.json({ error: owned.error, log }, { status: owned.status });
    }

    if (owned.row.appointment_id !== appointmentId) {
      return NextResponse.json({ error: "Transcrição não pertence a esta consulta.", log }, { status: 400 });
    }

    if (owned.row.transcription_mode !== "streaming") {
      return NextResponse.json({ error: "Transcrição não é do modo streaming.", log }, { status: 400 });
    }

    const durationSeconds =
      typeof body.recordingDurationSeconds === "number" &&
      Number.isFinite(body.recordingDurationSeconds)
        ? body.recordingDurationSeconds
        : null;

    if (durationSeconds != null && durationSeconds < 1) {
      return NextResponse.json(
        { error: "Gravação muito curta. Fale por pelo menos 1 segundo.", log },
        { status: 400 }
      );
    }

    let transcript = (body.liveTranscript ?? owned.row.live_transcript ?? "").trim();
    let segments = parseTranscriptSegments(body.transcriptSegments ?? owned.row.transcript_segments);
    let resolvedDuration = durationSeconds;

    if (owned.row.stream_session_id) {
      try {
        log.push("Consultando artefatos da sessão na VPS…");
        const artifact = await getStreamSessionArtifact(owned.row.stream_session_id);
        if (artifact.full_text?.trim()) {
          transcript = artifact.full_text.trim();
        }
        if (artifact.segments?.length) {
          segments = artifact.segments;
        }
        if (artifact.duration_seconds != null) {
          resolvedDuration = artifact.duration_seconds;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.push(`Aviso: artefato VPS indisponível (${message}). Usando backup local.`);
      }
    }

    if (!transcript && segments?.length) {
      transcript = segments
        .filter((s) => s.is_final)
        .map((s) => s.text)
        .join(" ")
        .trim();
    }

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcrição vazia. Nenhum texto foi capturado.", log },
        { status: 400 }
      );
    }

    const postProcessingStatus = isClinicalPostProcessingEnabled() ? "pending" : "skipped";

    await owned.supabase
      .from("appointment_transcriptions")
      .update({
        transcript,
        live_transcript: transcript,
        transcript_segments: segments ?? null,
        duration_seconds: resolvedDuration,
        status: "processing",
        post_processing_status: postProcessingStatus,
        post_processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.transcriptionId);

    log.push("Transcrição salva. Iniciando pós-processamento…");

    if (isClinicalPostProcessingEnabled()) {
      waitUntil(runClinicalPostProcessing(body.transcriptionId));
    } else {
      await owned.supabase
        .from("appointment_transcriptions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.transcriptionId);
      log.push("Pós-processamento desabilitado — transcrição concluída.");
    }

    return NextResponse.json({
      transcriptionId: body.transcriptionId,
      status: "processing",
      postProcessingStatus,
      log,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    log.push(message);
    const status = message === "Não autenticado" ? 401 : 500;
    return NextResponse.json({ error: message, log }, { status });
  }
}
