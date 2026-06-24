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
  if (!res.ok) {
    throw new Error(`Falha ao baixar mídia (${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 100) {
    throw new Error(`Arquivo de áudio muito pequeno (${buffer.length} bytes)`);
  }
  if (buffer.subarray(0, 1).toString() === "<") {
    throw new Error(
      "Download retornou HTML em vez de áudio — verifique se o bucket whatsapp-media é público"
    );
  }
  return buffer;
}

async function startTranscriptionJobForMessage(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  msg: InboundMessageRow
): Promise<{ jobId: string } | { unsupported: string }> {
  const buffer = await downloadMediaAsBuffer(msg.media_url!);
  const file = getTranscribeAudioFile(msg.id, msg.media_mime_type, msg.media_url, buffer);
  if (file.unsupported) {
    return { unsupported: file.unsupported };
  }
  const jobId = await createTranscriptionJob(
    buffer,
    file.filename,
    `clinic-${clinicId}`,
    "whatsapp",
    { mimeType: file.mimeType }
  );
  logAiEvent(supabase, {
    clinicId,
    conversationId,
    messageId: msg.id,
    stage: "audio_transcribe_start",
    detail: { jobId, mimeType: file.mimeType, filename: file.filename, bytes: buffer.byteLength },
  });
  return { jobId };
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
  const retriedIds = new Set(aiState.audio_transcription_retried_message_ids ?? []);

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
    let shouldCreateJob = !existingJobId;

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
          const errMsg = job.error_message ?? "falhou";
          const isServerError = /internal server error/i.test(errMsg);
          if (isServerError && !retriedIds.has(msg.id)) {
            retriedIds.add(msg.id);
            shouldCreateJob = true;
            logAiEvent(supabase, {
              clinicId,
              conversationId,
              messageId: msg.id,
              stage: "audio_transcribe_failed",
              level: "warn",
              detail: { jobId: existingJobId, reason: errMsg, retrying: true },
            });
          } else {
            audioFailedIds.push(msg.id);
            logAiEvent(supabase, {
              clinicId,
              conversationId,
              messageId: msg.id,
              stage: "audio_transcribe_failed",
              level: "error",
              detail: { jobId: existingJobId, reason: errMsg },
            });
          }
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

      if (!shouldCreateJob) {
        continue;
      }
    }

    if (shouldCreateJob) {
      try {
        const result = await startTranscriptionJobForMessage(
          supabase,
          clinicId,
          conversationId,
          msg
        );
        if ("unsupported" in result) {
          audioFailedIds.push(msg.id);
          logAiEvent(supabase, {
            clinicId,
            conversationId,
            messageId: msg.id,
            stage: "audio_transcribe_failed",
            level: "warn",
            detail: { reason: result.unsupported },
          });
          continue;
        }
        stillPending.push({ messageId: msg.id, jobId: result.jobId });
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
  }

  const nextState: AiConversationState = { ...aiState };
  if (retriedIds.size > 0) {
    nextState.audio_transcription_retried_message_ids = [...retriedIds];
  }
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
