import type { SupabaseClient } from "@supabase/supabase-js";
import { createTranscriptionJob, getTranscriptionJob } from "@/lib/transcribe-api";
import { getTranscribeAudioFile } from "@/lib/whatsapp-media";
import { logAiEvent } from "./event-log";
import type { AiConversationState, PendingTranscriptionJob } from "./types";

export const AUDIO_FALLBACK_MESSAGE =
  "Não consegui entender o áudio. Pode repetir por texto ou gravar de novo?";

export interface InboundMessageRow {
  id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  media_mime_type?: string | null;
}

export interface ResolveInboundTextsResult {
  userTexts: string[];
  audioFailedIds: string[];
  waitingForTranscription: boolean;
  aiState: AiConversationState;
}

async function downloadMediaAsBuffer(mediaUrl: string): Promise<Buffer> {
  const res = await fetch(mediaUrl);
  if (!res.ok) throw new Error(`Falha ao baixar mídia (${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function isUsableText(text: string): boolean {
  const t = text.trim();
  return Boolean(t) && t !== "[audio]" && !t.startsWith("[");
}

export async function resolveInboundTexts(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  pending: InboundMessageRow[],
  aiState: AiConversationState
): Promise<ResolveInboundTextsResult> {
  const userTexts: string[] = [];
  const audioFailedIds: string[] = [];
  const stillPending: PendingTranscriptionJob[] = [];
  const jobMap = new Map(
    (aiState.pending_transcription_jobs ?? []).map((j) => [j.messageId, j.jobId])
  );

  for (const msg of pending) {
    let text = String(msg.content ?? "").trim();

    if (msg.message_type !== "audio") {
      if (isUsableText(text)) {
        userTexts.push(text);
      } else if (msg.message_type === "image" || msg.message_type === "video") {
        userTexts.push(`[Paciente enviou ${msg.message_type}]`);
      }
      continue;
    }

    if (isUsableText(text)) {
      userTexts.push(text);
      continue;
    }

    if (!msg.media_url) {
      logAiEvent(supabase, {
        clinicId,
        conversationId,
        messageId: msg.id,
        stage: "audio_no_media",
        level: "warn",
      });
      audioFailedIds.push(msg.id);
      continue;
    }

    const existingJobId = jobMap.get(msg.id);
    if (existingJobId) {
      try {
        const job = await getTranscriptionJob(existingJobId);
        if (job.status === "completed") {
          const transcribed = (job.text ?? "").trim();
          if (transcribed) {
            await supabase.from("whatsapp_messages").update({ content: transcribed }).eq("id", msg.id);
            userTexts.push(transcribed);
            logAiEvent(supabase, {
              clinicId,
              conversationId,
              messageId: msg.id,
              stage: "audio_transcribe_ok",
              detail: { jobId: existingJobId, preview: transcribed.slice(0, 80) },
            });
          } else {
            audioFailedIds.push(msg.id);
            logAiEvent(supabase, {
              clinicId,
              conversationId,
              messageId: msg.id,
              stage: "audio_transcribe_failed",
              level: "warn",
              detail: { jobId: existingJobId, reason: "texto vazio" },
            });
          }
        } else if (job.status === "failed") {
          audioFailedIds.push(msg.id);
          logAiEvent(supabase, {
            clinicId,
            conversationId,
            messageId: msg.id,
            stage: "audio_transcribe_failed",
            level: "error",
            detail: { jobId: existingJobId, reason: job.error_message ?? "falhou" },
          });
        } else {
          stillPending.push({ messageId: msg.id, jobId: existingJobId });
        }
      } catch (e) {
        audioFailedIds.push(msg.id);
        logAiEvent(supabase, {
          clinicId,
          conversationId,
          messageId: msg.id,
          stage: "audio_transcribe_failed",
          level: "error",
          detail: {
            jobId: existingJobId,
            reason: e instanceof Error ? e.message : String(e),
          },
        });
      }
      continue;
    }

    try {
      const { filename, mimeType } = getTranscribeAudioFile(
        msg.id,
        msg.media_mime_type,
        msg.media_url
      );
      const buffer = await downloadMediaAsBuffer(msg.media_url);
      const jobId = await createTranscriptionJob(
        buffer,
        filename,
        `clinic-${clinicId}`,
        "whatsapp",
        { mimeType }
      );
      logAiEvent(supabase, {
        clinicId,
        conversationId,
        messageId: msg.id,
        stage: "audio_transcribe_start",
        detail: { jobId, mimeType, filename, bytes: buffer.byteLength },
      });
      stillPending.push({ messageId: msg.id, jobId });
    } catch (e) {
      console.error("[VirtualAssistant] transcribe start:", e);
      audioFailedIds.push(msg.id);
      logAiEvent(supabase, {
        clinicId,
        conversationId,
        messageId: msg.id,
        stage: "audio_transcribe_failed",
        level: "error",
        detail: { reason: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  const nextState: AiConversationState = { ...aiState };
  if (stillPending.length > 0) {
    nextState.pending_transcription_jobs = stillPending;
  } else {
    delete nextState.pending_transcription_jobs;
  }

  return {
    userTexts,
    audioFailedIds,
    waitingForTranscription: stillPending.length > 0,
    aiState: nextState,
  };
}

export async function scheduleTranscriptionRetry(
  supabase: SupabaseClient,
  conversationId: string,
  aiState: AiConversationState
): Promise<void> {
  const retryAt = new Date(Date.now() + 3000).toISOString();
  await supabase
    .from("whatsapp_conversations")
    .update({
      ai_state: aiState,
      ai_debounce_until: retryAt,
    })
    .eq("id", conversationId);
}
