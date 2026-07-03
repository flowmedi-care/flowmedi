import { NextRequest, NextResponse } from "next/server";
import { requireClinicalTranscriptionAccess } from "@/lib/clinical-transcription/access";
import { isClinicalStreamingEnabled } from "@/lib/clinical-transcription/feature-flags";
import { createStreamSession, resolvePublicStreamWsUrl } from "@/lib/transcribe-stream-api";

/**
 * POST /api/appointments/[id]/transcribe/stream/session
 * Cria registro no banco e sessão de streaming na VPS.
 */
export async function POST(
  _request: NextRequest,
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

    log.push("Consulta validada.");

    const { data: row, error: insertError } = await access.supabase
      .from("appointment_transcriptions")
      .insert({
        appointment_id: appointmentId,
        clinic_id: access.clinicId,
        created_by: access.userId,
        status: "streaming",
        transcription_mode: "streaming",
      })
      .select("id")
      .single();

    if (insertError || !row) {
      console.error("[TranscribeStream] insert error:", insertError);
      return NextResponse.json({ error: "Erro ao registrar transcrição.", log }, { status: 500 });
    }

    log.push(`Registro criado (${row.id.slice(0, 8)}…).`);

    try {
      log.push("Criando sessão de streaming na VPS…");
      const session = await createStreamSession({
        userId: access.clinicId,
        appointmentId,
      });

      await access.supabase
        .from("appointment_transcriptions")
        .update({
          stream_session_id: session.session_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      log.push(`Sessão criada (${session.session_id.slice(0, 8)}…).`);

      return NextResponse.json({
        transcriptionId: row.id,
        sessionId: session.session_id,
        wsUrl: resolvePublicStreamWsUrl(session.ws_url, session.ws_token),
        expiresAt: session.expires_at,
        status: "streaming",
        log,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar sessão de streaming.";
      log.push(`Erro: ${message}`);

      await access.supabase
        .from("appointment_transcriptions")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      return NextResponse.json({ error: message, log }, { status: 502 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    log.push(message);
    const status = message === "Não autenticado" ? 401 : 500;
    return NextResponse.json({ error: message, log }, { status });
  }
}
