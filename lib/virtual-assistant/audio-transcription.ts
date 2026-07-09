import type { SupabaseClient } from "@supabase/supabase-js";
import { transcribeAudioBuffer } from "@/lib/openai-transcribe";
import { createTranscriptionJob, getTranscriptionJob } from "@/lib/transcribe-api";
import { getTranscribeAudioFile, WHATSAPP_MEDIA_BUCKET } from "@/lib/whatsapp-media";
import { downloadStorageObject } from "@/lib/storage/signed-url";
import { logAiEvent } from "./event-log";
import type { AiConversationState, PendingTranscriptionJob } from "./types";

export const AUDIO_FALLBACK_MESSAGE =
  "Não consegui entender o áudio. Pode repetir por texto ou gravar de novo?";

export type WppTranscriptionProvider = "openai" | "viaprove";

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

export function getWppTranscriptionProvider(): WppTranscriptionProvider {
  const raw = process.env.WPP_TRANSCRIPTION_PROVIDER?.trim().toLowerCase();
  return raw === "viaprove" ? "viaprove" : "openai";
}

async function downloadMediaAsBuffer(
  supabase: SupabaseClient,
  mediaUrl: string
): Promise<Buffer> {
  const { buffer, error } = await downloadStorageObject(
    supabase,
    WHATSAPP_MEDIA_BUCKET,
    mediaUrl
  );
  if (error || !buffer) {
    throw new Error(error ?? "Falha ao baixar mídia");
  }
  if (buffer.length < 100) {
    throw new Error(`Arquivo de áudio muito pequeno (${buffer.length} bytes)`);
  }
  if (buffer.subarray(0, 1).toString() === "<") {
    throw new Error(
      "Download retornou HTML em vez de áudio — verifique o acesso ao storage."
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
  const buffer = await downloadMediaAsBuffer(supabase, msg.media_url!);
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
    detail: {
      provider: "viaprove",
      jobId,
      mimeType: file.mimeType,
      filename: file.filename,
      bytes: buffer.byteLength,
    },
  });
  return { jobId };
}

async function transcribeMessageWithOpenAI(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  msg: InboundMessageRow
): Promise<{ text: string; processingMs: number } | { unsupported: string }> {
  const buffer = await downloadMediaAsBuffer(supabase, msg.media_url!);
  const file = getTranscribeAudioFile(msg.id, msg.media_mime_type, msg.media_url, buffer);
  if (file.unsupported) {
    return { unsupported: file.unsupported };
  }

  logAiEvent(supabase, {
    clinicId,
    conversationId,
    messageId: msg.id,
    stage: "audio_transcribe_start",
    detail: {
      provider: "openai",
      mimeType: file.mimeType,
      filename: file.filename,
      bytes: buffer.byteLength,
    },
  });

  const result = await transcribeAudioBuffer(buffer, {
    filename: file.filename,
    mimeType: file.mimeType,
  });

  return result;
}

function isUsableText(text: string): boolean {
  const t = text.trim();
  return Boolean(t) && t !== "[audio]" && !t.startsWith("[");
}

async function pollLegacyTranscriptionJob(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  msg: InboundMessageRow,
  existingJobId: string,
  retriedIds: Set<string>
): Promise<
  | { kind: "completed"; text: string }
  | { kind: "failed" }
  | { kind: "pending"; jobId: string }
  | { kind: "retry"; jobId: string }
> {
  const job = await getTranscriptionJob(existingJobId);
  if (job.status === "completed") {
    const transcribed = (job.text ?? "").trim();
    if (transcribed) {
      await supabase.from("whatsapp_messages").update({ content: transcribed }).eq("id", msg.id);
      logAiEvent(supabase, {
        clinicId,
        conversationId,
        messageId: msg.id,
        stage: "audio_transcribe_ok",
        detail: {
          provider: "viaprove",
          jobId: existingJobId,
          preview: transcribed.slice(0, 80),
        },
      });
      return { kind: "completed", text: transcribed };
    }

    logAiEvent(supabase, {
      clinicId,
      conversationId,
      messageId: msg.id,
      stage: "audio_transcribe_failed",
      level: "warn",
      detail: { provider: "viaprove", jobId: existingJobId, reason: "texto vazio" },
    });
    return { kind: "failed" };
  }

  if (job.status === "failed") {
    const errMsg = job.error_message ?? "falhou";
    const isServerError = /internal server error/i.test(errMsg);
    if (isServerError && !retriedIds.has(msg.id)) {
      retriedIds.add(msg.id);
      logAiEvent(supabase, {
        clinicId,
        conversationId,
        messageId: msg.id,
        stage: "audio_transcribe_failed",
        level: "warn",
        detail: { provider: "viaprove", jobId: existingJobId, reason: errMsg, retrying: true },
      });
      return { kind: "retry", jobId: existingJobId };
    }

    logAiEvent(supabase, {
      clinicId,
      conversationId,
      messageId: msg.id,
      stage: "audio_transcribe_failed",
      level: "error",
      detail: { provider: "viaprove", jobId: existingJobId, reason: errMsg },
    });
    return { kind: "failed" };
  }

  return { kind: "pending", jobId: existingJobId };
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
  const provider = getWppTranscriptionProvider();

  for (const msg of pending) {
    const text = String(msg.content ?? "").trim();

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
        const pollResult = await pollLegacyTranscriptionJob(
          supabase,
          clinicId,
          conversationId,
          msg,
          existingJobId,
          retriedIds
        );

        if (pollResult.kind === "completed") {
          userTexts.push(pollResult.text);
          shouldCreateJob = false;
        } else if (pollResult.kind === "failed") {
          audioFailedIds.push(msg.id);
          shouldCreateJob = false;
        } else if (pollResult.kind === "retry") {
          shouldCreateJob = true;
        } else {
          stillPending.push({ messageId: msg.id, jobId: pollResult.jobId });
          shouldCreateJob = false;
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
            provider: "viaprove",
            jobId: existingJobId,
            reason: e instanceof Error ? e.message : String(e),
          },
        });
        shouldCreateJob = false;
      }

      if (!shouldCreateJob) {
        continue;
      }
    }

    if (!shouldCreateJob) {
      continue;
    }

    if (provider === "openai") {
      try {
        const result = await transcribeMessageWithOpenAI(
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
            detail: { provider: "openai", reason: result.unsupported },
          });
          continue;
        }

        await supabase
          .from("whatsapp_messages")
          .update({ content: result.text })
          .eq("id", msg.id);
        userTexts.push(result.text);
        logAiEvent(supabase, {
          clinicId,
          conversationId,
          messageId: msg.id,
          stage: "audio_transcribe_ok",
          detail: {
            provider: "openai",
            processingMs: result.processingMs,
            preview: result.text.slice(0, 80),
          },
        });
      } catch (e) {
        console.error("[VirtualAssistant] openai transcribe:", e);
        audioFailedIds.push(msg.id);
        logAiEvent(supabase, {
          clinicId,
          conversationId,
          messageId: msg.id,
          stage: "audio_transcribe_failed",
          level: "error",
          detail: {
            provider: "openai",
            reason: e instanceof Error ? e.message : String(e),
          },
        });
      }
      continue;
    }

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
          detail: { provider: "viaprove", reason: result.unsupported },
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
        detail: {
          provider: "viaprove",
          reason: e instanceof Error ? e.message : String(e),
        },
      });
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
