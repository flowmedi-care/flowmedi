import { createClient } from "@supabase/supabase-js";
import { getStreamSessionArtifact } from "@/lib/transcribe-stream-api";
import {
  parseClinicalSummary,
  parseDialogue,
  parseTranscriptSegments,
  type TranscriptSegment,
} from "@/lib/clinical-transcription/types";
import {
  isClinicalPostProcessingEnabled,
  shouldStoreClinicalAudio,
} from "@/lib/clinical-transcription/feature-flags";
import { createClinicalJsonCompletion } from "@/lib/clinical-transcription/openai-clinical";
import {
  buildDiarizationSystemPrompt,
  buildDiarizationUserPrompt,
} from "@/lib/clinical-transcription/prompts/diarize";
import {
  buildSummarizationSystemPrompt,
  buildSummarizationUserPrompt,
} from "@/lib/clinical-transcription/prompts/summarize";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role não configurado para pós-processamento.");
  }
  return createClient(url, key);
}

type TranscriptionRow = {
  id: string;
  appointment_id: string;
  clinic_id: string;
  transcript: string | null;
  live_transcript: string | null;
  transcript_segments: unknown;
  stream_session_id: string | null;
  transcription_mode: string;
  post_processing_status: string | null;
};

async function loadContext(supabase: ReturnType<typeof getServiceSupabase>, row: TranscriptionRow) {
  const { data: appointment } = await supabase
    .from("appointments")
    .select("patient:patients!patient_id(full_name), doctor:profiles!appointments_doctor_id_fkey(full_name)")
    .eq("id", row.appointment_id)
    .maybeSingle();

  const patientRaw = Array.isArray(appointment?.patient)
    ? appointment?.patient[0]
    : appointment?.patient;
  const doctorRaw = Array.isArray(appointment?.doctor)
    ? appointment?.doctor[0]
    : appointment?.doctor;

  return {
    patientName: String((patientRaw as { full_name?: string })?.full_name ?? "Paciente"),
    doctorName: String((doctorRaw as { full_name?: string })?.full_name ?? "Médico"),
  };
}

async function resolveTranscriptText(
  row: TranscriptionRow,
  segments: TranscriptSegment[] | null
): Promise<{ transcript: string; durationSeconds: number | null }> {
  let transcript = (row.transcript ?? row.live_transcript ?? "").trim();
  let durationSeconds: number | null = null;

  if (row.stream_session_id) {
    try {
      const artifact = await getStreamSessionArtifact(row.stream_session_id);
      if (artifact.full_text?.trim()) {
        transcript = artifact.full_text.trim();
      }
      if (artifact.duration_seconds != null) {
        durationSeconds = artifact.duration_seconds;
      }
      if (!segments && artifact.segments?.length) {
        segments = artifact.segments;
      }
    } catch (err) {
      console.warn("[ClinicalPostProcess] stream artifact unavailable", {
        transcriptionId: row.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!transcript && segments?.length) {
    transcript = segments
      .filter((s) => s.is_final)
      .map((s) => s.text)
      .join(" ")
      .trim();
  }

  return { transcript, durationSeconds };
}

export async function runClinicalPostProcessing(transcriptionId: string): Promise<void> {
  const supabase = getServiceSupabase();

  const { data: row, error } = await supabase
    .from("appointment_transcriptions")
    .select(
      "id, appointment_id, clinic_id, transcript, live_transcript, transcript_segments, stream_session_id, transcription_mode, post_processing_status"
    )
    .eq("id", transcriptionId)
    .maybeSingle();

  if (error || !row) {
    console.error("[ClinicalPostProcess] row not found", { transcriptionId, error });
    return;
  }

  if (row.post_processing_status === "completed" || row.post_processing_status === "processing") {
    return;
  }

  if (!isClinicalPostProcessingEnabled()) {
    await supabase
      .from("appointment_transcriptions")
      .update({
        post_processing_status: "skipped",
        status: "completed",
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq("id", transcriptionId);
    return;
  }

  await supabase
    .from("appointment_transcriptions")
    .update({
      post_processing_status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", transcriptionId);

  try {
    const context = await loadContext(supabase, row as TranscriptionRow);
    const segments = parseTranscriptSegments(row.transcript_segments);
    const { transcript, durationSeconds } = await resolveTranscriptText(
      row as TranscriptionRow,
      segments
    );

    if (!transcript) {
      throw new Error("Transcrição vazia — impossível executar pós-processamento.");
    }

    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error("OPENAI_API_KEY não configurada para pós-processamento clínico.");
    }

    const segmentsJson = segments ? JSON.stringify(segments) : undefined;

    const diarizeRaw = await createClinicalJsonCompletion({
      systemPrompt: buildDiarizationSystemPrompt(),
      userPrompt: buildDiarizationUserPrompt({
        transcript,
        patientName: context.patientName,
        doctorName: context.doctorName,
        segmentsJson,
      }),
      maxTokens: 6000,
    });

    const diarizeParsed = JSON.parse(diarizeRaw) as {
      dialogue?: unknown;
      avisos?: string[];
    };
    const dialogue = parseDialogue(diarizeParsed.dialogue) ?? [];

    const summaryRaw = await createClinicalJsonCompletion({
      systemPrompt: buildSummarizationSystemPrompt(),
      userPrompt: buildSummarizationUserPrompt({
        transcript,
        dialogueJson: JSON.stringify(dialogue),
        patientName: context.patientName,
        doctorName: context.doctorName,
      }),
      maxTokens: 4000,
    });

    const summaryParsed = JSON.parse(summaryRaw) as Record<string, unknown>;
    const clinicalSummary = parseClinicalSummary(summaryParsed);
    if (!clinicalSummary) {
      throw new Error("Resumo clínico inválido retornado pela IA.");
    }

    if (diarizeParsed.avisos?.length) {
      clinicalSummary.avisos = [
        ...new Set([...clinicalSummary.avisos, ...diarizeParsed.avisos.filter(Boolean)]),
      ];
    }

    const now = new Date().toISOString();
    await supabase
      .from("appointment_transcriptions")
      .update({
        transcript,
        dialogue,
        clinical_summary: clinicalSummary,
        post_processing_status: "completed",
        post_processing_error: null,
        status: "completed",
        duration_seconds: durationSeconds,
        completed_at: now,
        summarized_at: now,
        updated_at: now,
        audio_storage_path: shouldStoreClinicalAudio() ? row.stream_session_id : null,
      })
      .eq("id", transcriptionId);

    console.info("[ClinicalPostProcess] completed", { transcriptionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro no pós-processamento.";
    console.error("[ClinicalPostProcess] failed", { transcriptionId, message });
    await supabase
      .from("appointment_transcriptions")
      .update({
        post_processing_status: "failed",
        post_processing_error: message,
        status: "completed",
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq("id", transcriptionId);
  }
}

export async function processStuckClinicalTranscriptions(limit = 10): Promise<number> {
  const supabase = getServiceSupabase();
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("appointment_transcriptions")
    .select("id")
    .in("post_processing_status", ["pending", "processing"])
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error || !rows?.length) {
    return 0;
  }

  for (const row of rows) {
    await runClinicalPostProcessing(row.id);
  }

  return rows.length;
}
