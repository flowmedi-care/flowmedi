"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import fixWebmDuration from "fix-webm-duration";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2, Mic, Square, XCircle } from "lucide-react";
import type {
  ClinicalSummary,
  DialogueTurn,
  TranscriptSegment,
} from "@/lib/clinical-transcription/types";
import {
  buildLiveTranscriptFromSegments,
  ClinicalStreamConnection,
} from "@/lib/clinical-transcription/streaming-client";
import {
  createMediaRecorder,
  startMediaRecorder,
  stopMediaRecorder,
  getMicrophoneErrorMessage,
  requestMicrophoneStream,
} from "@/lib/clinical-transcription/microphone";
import {
  ClinicalSpeechPreview,
  isSpeechPreviewSupported,
} from "@/lib/clinical-transcription/speech-preview";
import type { ClinicalStreamingMode } from "@/lib/clinical-transcription/feature-flags";
import { ClinicalTranscriptionDetail } from "./clinical-transcription-detail";
import { ClinicalAudioWaveform } from "./clinical-audio-waveform";

type TranscriptionRecord = {
  id: string;
  status: string;
  transcription_mode?: string;
  transcript: string | null;
  live_transcript?: string | null;
  dialogue?: DialogueTurn[] | null;
  clinical_summary?: ClinicalSummary | null;
  post_processing_status?: string | null;
  post_processing_error?: string | null;
  error_message: string | null;
  duration_seconds: number | null;
  processing_time_seconds: number | null;
  created_at: string;
  completed_at: string | null;
  summarized_at?: string | null;
};

type PanelPhase =
  | "idle"
  | "starting"
  | "recording"
  | "streaming"
  | "uploading"
  | "transcribing"
  | "finalizing"
  | "post_processing";

type LogEntry = {
  id: string;
  message: string;
  level: "info" | "success" | "error";
};

const POLL_INTERVAL_MS = 3000;
const LIVE_BACKUP_INTERVAL_MS = 5000;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: string, postProcessingStatus?: string | null): string {
  if (status === "streaming") return "Ao vivo";
  if (postProcessingStatus === "processing" || postProcessingStatus === "pending") {
    return "Gerando relatório";
  }
  switch (status) {
    case "completed":
      return "Concluída";
    case "failed":
      return "Falhou";
    case "processing":
    case "queued":
      return "Processando";
    default:
      return status;
  }
}

function pickMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return undefined;
}

function extensionForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function LogIcon({ level }: { level: LogEntry["level"] }) {
  if (level === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />;
  if (level === "error") return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

export function ClinicalTranscriptionPanel({
  appointmentId,
  canRecord,
  streamingMode = "off",
  fallbackToBatch = true,
}: {
  appointmentId: string;
  canRecord: boolean;
  streamingMode?: ClinicalStreamingMode;
  fallbackToBatch?: boolean;
}) {
  const isHybridMode = streamingMode === "hybrid";
  const isRealtimeMode = streamingMode === "realtime";
  const [transcriptions, setTranscriptions] = useState<TranscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<PanelPhase>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeTranscriptionId, setActiveTranscriptionId] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<LogEntry[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [audioPreviewStream, setAudioPreviewStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveBackupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSecondsRef = useRef(0);
  const logIdRef = useRef(0);
  const streamConnectionRef = useRef<ClinicalStreamConnection | null>(null);
  const streamSessionRef = useRef<{ transcriptionId: string; wsUrl: string } | null>(null);
  const streamSegmentsRef = useRef<TranscriptSegment[]>([]);
  const liveTranscriptRef = useRef("");
  const speechPreviewRef = useRef<ClinicalSpeechPreview | null>(null);
  const isStartingRef = useRef(false);
  const sessionAbortRef = useRef<AbortController | null>(null);
  const startFlowAbortRef = useRef<AbortController | null>(null);
  const userCancelledStartRef = useRef(false);

  const isStartFlowAborted = useCallback(() => startFlowAbortRef.current?.signal.aborted ?? false, []);

  const appendLog = useCallback((message: string, level: LogEntry["level"] = "info") => {
    logIdRef.current += 1;
    setActivityLog((prev) => [...prev, { id: String(logIdRef.current), message, level }]);
  }, []);

  const clearActivityLog = useCallback(() => setActivityLog([]), []);

  const stopMediaTracks = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setAudioPreviewStream(null);
  }, []);

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const clearLiveBackupTimer = useCallback(() => {
    if (liveBackupTimerRef.current) {
      clearInterval(liveBackupTimerRef.current);
      liveBackupTimerRef.current = null;
    }
  }, []);

  const loadTranscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/transcriptions`);
      const data = (await res.json()) as {
        error?: string;
        transcriptions?: TranscriptionRecord[];
      };
      if (!res.ok) {
        toast(data.error ?? "Erro ao carregar transcrições.", "error");
        return;
      }
      setTranscriptions(data.transcriptions ?? []);

      const inProgress = (data.transcriptions ?? []).find(
        (t) =>
          t.status === "processing" ||
          t.status === "queued" ||
          t.post_processing_status === "pending" ||
          t.post_processing_status === "processing"
      );
      if (inProgress) {
        setActiveTranscriptionId(inProgress.id);
        if (
          inProgress.post_processing_status === "pending" ||
          inProgress.post_processing_status === "processing"
        ) {
          setPhase("post_processing");
        } else {
          setPhase("transcribing");
        }
      }
    } catch {
      toast("Erro ao carregar transcrições.", "error");
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  const stopSpeechPreview = useCallback(() => {
    speechPreviewRef.current?.stop();
    speechPreviewRef.current = null;
  }, []);

  const startHybridSpeechPreview = useCallback(() => {
    liveTranscriptRef.current = "";
    setLiveTranscript("");
    if (!isSpeechPreviewSupported()) {
      appendLog("Prévia indisponível neste navegador — Whisper transcreve ao parar.", "error");
      return;
    }
    speechPreviewRef.current = new ClinicalSpeechPreview({
      onInterim: (text) => {
        liveTranscriptRef.current = text;
        setLiveTranscript(text);
      },
      onFinal: (text) => {
        liveTranscriptRef.current = text;
        setLiveTranscript(text);
      },
      onError: (message) => appendLog(message, "error"),
    });
    speechPreviewRef.current.start();
    appendLog("Prévia de voz ativa (quase instantânea).");
  }, [appendLog]);

  const backupLiveTranscript = useCallback(async () => {
    const session = streamSessionRef.current;
    if (!session) return;
    const transcript = liveTranscriptRef.current.trim();
    if (!transcript && streamSegmentsRef.current.length === 0) return;

    try {
      await fetch(
        `/api/appointments/${appointmentId}/transcriptions/${session.transcriptionId}/live`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            liveTranscript: transcript,
            transcriptSegments: streamSegmentsRef.current,
            recordingDurationSeconds: recordingSecondsRef.current,
          }),
        }
      );
    } catch {
      // backup silencioso
    }
  }, [appointmentId]);

  const pollTranscriptionDetail = useCallback(
    async (transcriptionId: string, pollCount = 0) => {
      try {
        const res = await fetch(
          `/api/appointments/${appointmentId}/transcriptions/${transcriptionId}`
        );
        const data = (await res.json()) as TranscriptionRecord & { error?: string };

        if (!res.ok) {
          appendLog(data.error ?? "Erro ao consultar transcrição.", "error");
          setPhase("idle");
          setActiveTranscriptionId(null);
          await loadTranscriptions();
          return;
        }

        if (data.post_processing_status === "completed") {
          appendLog("Relatório clínico gerado com sucesso.", "success");
          toast("Transcrição e relatório concluídos.", "success");
          setPhase("idle");
          setActiveTranscriptionId(null);
          await loadTranscriptions();
          return;
        }

        if (data.post_processing_status === "failed") {
          appendLog(data.post_processing_error ?? "Pós-processamento falhou.", "error");
          toast(data.post_processing_error ?? "Relatório clínico falhou.", "error");
          setPhase("idle");
          setActiveTranscriptionId(null);
          await loadTranscriptions();
          return;
        }

        if (data.status === "completed" && !data.post_processing_status) {
          appendLog("Transcrição concluída.", "success");
          setPhase("idle");
          setActiveTranscriptionId(null);
          await loadTranscriptions();
          return;
        }

        if (pollCount % 5 === 0) {
          appendLog("Gerando diálogo e resumo clínico…");
        }

        pollTimerRef.current = setTimeout(() => {
          void pollTranscriptionDetail(transcriptionId, pollCount + 1);
        }, POLL_INTERVAL_MS);
      } catch {
        appendLog("Erro de rede ao consultar transcrição.", "error");
        setPhase("idle");
        setActiveTranscriptionId(null);
      }
    },
    [appointmentId, appendLog, loadTranscriptions]
  );

  const pollBatchJob = useCallback(
    async (transcriptionId: string, pollCount = 0) => {
      try {
        if (pollCount === 0) appendLog("Consultando status na API de transcrição…");

        const res = await fetch(`/api/transcribe/jobs/${transcriptionId}`);
        const data = (await res.json()) as {
          error?: string;
          status?: string;
          transcript?: string | null;
          error_message?: string | null;
          post_processing_status?: string | null;
        };

        if (!res.ok) {
          appendLog(data.error ?? "Erro ao consultar transcrição.", "error");
          setPhase("idle");
          setActiveTranscriptionId(null);
          await loadTranscriptions();
          return;
        }

        if (data.status === "completed") {
          if (
            data.post_processing_status === "pending" ||
            data.post_processing_status === "processing"
          ) {
            appendLog("Whisper concluído. Gerando relatório clínico…", "success");
            setPhase("post_processing");
            return;
          }
          appendLog("Transcrição concluída com sucesso.", "success");
          toast("Transcrição concluída.", "success");
          setPhase("idle");
          setActiveTranscriptionId(null);
          await loadTranscriptions();
          return;
        }

        if (data.status === "failed") {
          appendLog(data.error_message ?? "Transcrição falhou.", "error");
          setPhase("idle");
          setActiveTranscriptionId(null);
          await loadTranscriptions();
          return;
        }

        pollTimerRef.current = setTimeout(() => {
          void pollBatchJob(transcriptionId, pollCount + 1);
        }, POLL_INTERVAL_MS);
      } catch {
        appendLog("Erro de rede ao consultar transcrição.", "error");
        setPhase("idle");
        setActiveTranscriptionId(null);
      }
    },
    [appendLog, loadTranscriptions]
  );

  useEffect(() => {
    void loadTranscriptions();
  }, [loadTranscriptions]);

  useEffect(() => {
    if (phase === "post_processing" && activeTranscriptionId) {
      clearPollTimer();
      void pollTranscriptionDetail(activeTranscriptionId);
    }
    if (phase === "transcribing" && activeTranscriptionId) {
      clearPollTimer();
      void pollBatchJob(activeTranscriptionId);
    }
    return () => clearPollTimer();
  }, [
    phase,
    activeTranscriptionId,
    pollTranscriptionDetail,
    pollBatchJob,
    clearPollTimer,
  ]);

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      clearPollTimer();
      clearLiveBackupTimer();
      streamConnectionRef.current?.close();
      stopSpeechPreview();
      stopMediaRecorder(mediaRecorderRef.current);
      mediaRecorderRef.current = null;
      stopMediaTracks();
    };
  }, [clearRecordingTimer, clearPollTimer, clearLiveBackupTimer, stopMediaTracks]);

  async function startStreamingSession(
    mimeType: string,
    flowSignal?: AbortSignal
  ): Promise<"ok" | "failed" | "cancelled"> {
    if (isStartFlowAborted()) return "cancelled";

    appendLog("Iniciando sessão de transcrição em tempo real…");
    sessionAbortRef.current?.abort();
    const controller = new AbortController();
    sessionAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 25_000);
    const onFlowAbort = () => controller.abort();
    flowSignal?.addEventListener("abort", onFlowAbort);

    try {
      const res = await fetch(`/api/appointments/${appointmentId}/transcribe/stream/session`, {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      flowSignal?.removeEventListener("abort", onFlowAbort);
      sessionAbortRef.current = null;

      if (isStartFlowAborted() || userCancelledStartRef.current) {
        return "cancelled";
      }

      const data = (await res.json()) as {
        error?: string;
        transcriptionId?: string;
        wsUrl?: string;
        log?: string[];
      };

      if (Array.isArray(data.log)) {
        for (const line of data.log) appendLog(line, res.ok ? "info" : "error");
      }

      if (!res.ok || !data.transcriptionId || !data.wsUrl) {
        appendLog(data.error ?? "Falha ao criar sessão de streaming.", "error");
        return "failed";
      }

      appendLog("Sessão criada. Conectando WebSocket…");

      streamSessionRef.current = {
        transcriptionId: data.transcriptionId,
        wsUrl: data.wsUrl,
      };
      setActiveTranscriptionId(data.transcriptionId);
      streamSegmentsRef.current = [];
      liveTranscriptRef.current = "";
      setLiveTranscript("");

      const connection = new ClinicalStreamConnection(data.wsUrl, mimeType, {
        onPartial: (text) => {
          liveTranscriptRef.current = `${liveTranscriptRef.current} ${text}`.trim();
          setLiveTranscript(liveTranscriptRef.current);
        },
        onSegmentFinal: (segment) => {
          streamSegmentsRef.current = [...streamSegmentsRef.current, segment];
          liveTranscriptRef.current = buildLiveTranscriptFromSegments(streamSegmentsRef.current);
          setLiveTranscript(liveTranscriptRef.current);
        },
        onSessionComplete: (fullText) => {
          liveTranscriptRef.current = fullText.trim();
          setLiveTranscript(liveTranscriptRef.current);
          appendLog("Sessão de streaming finalizada na VPS.", "success");
        },
        onError: (message) => appendLog(message, "error"),
        onOpen: () => appendLog("Conexão de streaming estabelecida.", "success"),
        onClose: () => appendLog("Conexão de streaming encerrada."),
      });

      streamConnectionRef.current = connection;
      await connection.connect();

      if (isStartFlowAborted() || userCancelledStartRef.current) {
        connection.close();
        streamConnectionRef.current = null;
        streamSessionRef.current = null;
        return "cancelled";
      }

      liveBackupTimerRef.current = setInterval(() => {
        void backupLiveTranscript();
      }, LIVE_BACKUP_INTERVAL_MS);

      appendLog("Transcrição ao vivo ativa.");
      return "ok";
    } catch (error) {
      clearTimeout(timeoutId);
      flowSignal?.removeEventListener("abort", onFlowAbort);
      sessionAbortRef.current = null;
      if (isStartFlowAborted() || userCancelledStartRef.current) {
        return "cancelled";
      }
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "Tempo esgotado ao criar sessão de streaming (25s)."
          : error instanceof Error
            ? error.message
            : "Erro ao conectar streaming.";
      appendLog(message, "error");
      streamConnectionRef.current?.close();
      streamConnectionRef.current = null;
      streamSessionRef.current = null;
      return "failed";
    }
  }

  function handleCancelStarting() {
    userCancelledStartRef.current = true;
    startFlowAbortRef.current?.abort();
    appendLog("Preparação cancelada.", "error");
    sessionAbortRef.current?.abort();
    sessionAbortRef.current = null;
    stopSpeechPreview();
    streamConnectionRef.current?.close();
    streamConnectionRef.current = null;
    streamSessionRef.current = null;
    stopMediaRecorder(mediaRecorderRef.current);
    mediaRecorderRef.current = null;
    clearRecordingTimer();
    clearLiveBackupTimer();
    stopMediaTracks();
    setPhase("idle");
    isStartingRef.current = false;
  }

  async function runStreamingDiagnostics() {
    appendLog("Testando conexão com a API de streaming (servidor Flowmedi → VPS)…");
    try {
      const res = await fetch("/api/clinical-transcription/diagnostics");
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        streamApiUrl?: string;
        checks?: Array<{ label: string; ok: boolean; detail: string }>;
        hints?: string[];
      };

      if (!res.ok) {
        appendLog(data.error ?? "Diagnóstico indisponível.", "error");
        return;
      }

      appendLog(`URL da VPS: ${data.streamApiUrl ?? "?"}`);
      for (const check of data.checks ?? []) {
        appendLog(`${check.ok ? "OK" : "FALHA"} — ${check.label}: ${check.detail}`, check.ok ? "success" : "error");
      }
      for (const hint of data.hints ?? []) {
        appendLog(hint, "error");
      }
      if (data.ok) {
        appendLog("Diagnóstico: streaming pronto para uso.", "success");
        toast("API de streaming OK.", "success");
      } else {
        toast("Problema na API de streaming — veja o log.", "error");
      }
    } catch {
      appendLog("Erro de rede ao executar diagnóstico.", "error");
    }
  }

  async function handleStartRecording() {
    if (!canRecord || isStartingRef.current) return;
    isStartingRef.current = true;
    userCancelledStartRef.current = false;
    startFlowAbortRef.current?.abort();
    const startFlow = new AbortController();
    startFlowAbortRef.current = startFlow;

    clearActivityLog();
    streamConnectionRef.current?.close();
    streamConnectionRef.current = null;
    streamSessionRef.current = null;
    stopMediaRecorder(mediaRecorderRef.current);
    mediaRecorderRef.current = null;
    stopMediaTracks();

    appendLog("Solicitando acesso ao microfone…");

    try {
      const stream = await requestMicrophoneStream();
      if (isStartFlowAborted() || userCancelledStartRef.current) {
        stopMediaTracks();
        setPhase("idle");
        isStartingRef.current = false;
        return;
      }

      mediaStreamRef.current = stream;
      setAudioPreviewStream(stream);
      chunksRef.current = [];

      const mimeType = pickMimeType() ?? "audio/webm";
      appendLog(`Microfone ok. Formato: ${mimeType}.`);

      let streamingActive = false;
      if (isHybridMode) {
        setPhase("recording");
        startHybridSpeechPreview();
        appendLog("Gravando áudio. Transcrição Whisper + relatório ao parar.");
      } else if (isRealtimeMode) {
        setPhase("starting");
        appendLog("Conectando transcrição em tempo real (VPS)…");
        const streamResult = await startStreamingSession(mimeType, startFlow.signal);
        if (streamResult === "cancelled" || isStartFlowAborted() || userCancelledStartRef.current) {
          userCancelledStartRef.current = false;
          stopMediaTracks();
          setPhase("idle");
          isStartingRef.current = false;
          return;
        }
        streamingActive = streamResult === "ok";
        if (!streamingActive && !fallbackToBatch) {
          toast("Streaming indisponível.", "error");
          stopMediaTracks();
          setPhase("idle");
          isStartingRef.current = false;
          return;
        }
        if (!streamingActive && fallbackToBatch) {
          appendLog("Streaming indisponível — continuando em modo batch (gravação local).", "error");
          toast("Streaming indisponível. Gravando para transcrição ao final.", "error");
        }
      } else {
        setPhase("recording");
      }

      if (isStartFlowAborted() || userCancelledStartRef.current) {
        stopMediaTracks();
        setPhase("idle");
        isStartingRef.current = false;
        return;
      }

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length || audioTracks.some((track) => track.readyState !== "live")) {
        appendLog("Microfone indisponível após preparação. Tente novamente.", "error");
        toast("Microfone indisponível. Inicie a gravação de novo.", "error");
        stopMediaTracks();
        setPhase("idle");
        isStartingRef.current = false;
        return;
      }

      const recorder = createMediaRecorder(stream, mimeType);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          if (streamSessionRef.current) {
            streamConnectionRef.current?.sendAudioChunk(e.data);
          }
        }
      };

      recorder.onstop = () => {
        clearRecordingTimer();
        clearLiveBackupTimer();
        isStartingRef.current = false;
        const recordedMime = recorder.mimeType || mimeType;
        window.setTimeout(() => {
          stopMediaTracks();
          if (streamSessionRef.current) {
            void finalizeStreamingRecording(recordedMime);
          } else {
            void uploadRecording(recordedMime);
          }
        }, 50);
      };

      startMediaRecorder(recorder, streamingActive ? 500 : 1000);

      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      setPhase(streamingActive ? "streaming" : "recording");
      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
      appendLog(streamingActive ? "Gravação ao vivo iniciada." : "Gravação iniciada.");
      isStartingRef.current = false;
    } catch (error) {
      const recorder = mediaRecorderRef.current;
      if (recorder?.state === "recording") {
        recordingSecondsRef.current = 0;
        setRecordingSeconds(0);
        setPhase(streamSessionRef.current ? "streaming" : "recording");
        recordingTimerRef.current = setInterval(() => {
          recordingSecondsRef.current += 1;
          setRecordingSeconds(recordingSecondsRef.current);
        }, 1000);
        appendLog("Gravação iniciada.");
        isStartingRef.current = false;
        return;
      }

      const message = getMicrophoneErrorMessage(error);
      appendLog(message, "error");
      toast(message, "error");
      stopMediaRecorder(mediaRecorderRef.current);
      mediaRecorderRef.current = null;
      stopMediaTracks();
      setPhase("idle");
      isStartingRef.current = false;
    }
  }

  function handleStopRecording() {
    stopSpeechPreview();
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") {
      appendLog(`Gravação finalizada (${formatDuration(recordingSecondsRef.current)}).`);
      try {
        recorder.requestData();
      } catch {
        // ignore
      }
      recorder.stop();
    } else {
      isStartingRef.current = false;
      setPhase("idle");
      stopMediaTracks();
    }
  }

  async function finalizeStreamingRecording(mimeType: string) {
    setPhase("finalizing");
    const session = streamSessionRef.current;
    const durationSeconds = recordingSecondsRef.current;

    try {
      await streamConnectionRef.current?.end();
      streamConnectionRef.current?.close();
      streamConnectionRef.current = null;
      await backupLiveTranscript();

      if (!session) {
        throw new Error("Sessão de streaming não encontrada.");
      }

      const res = await fetch(`/api/appointments/${appointmentId}/transcribe/stream/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptionId: session.transcriptionId,
          recordingDurationSeconds: durationSeconds,
          liveTranscript: liveTranscriptRef.current,
          transcriptSegments: streamSegmentsRef.current,
        }),
      });

      const data = (await res.json()) as { error?: string; log?: string[]; postProcessingStatus?: string };
      if (Array.isArray(data.log)) {
        for (const line of data.log) appendLog(line, res.ok ? "info" : "error");
      }

      if (!res.ok) {
        if (fallbackToBatch && chunksRef.current.length > 0) {
          appendLog("Finalize falhou — tentando fallback batch…", "error");
          await uploadRecording(mimeType);
          return;
        }
        throw new Error(data.error ?? "Erro ao finalizar streaming.");
      }

      appendLog("Transcrição salva. Gerando relatório clínico…", "success");
      setActiveTranscriptionId(session.transcriptionId);
      setPhase(data.postProcessingStatus === "skipped" ? "idle" : "post_processing");
      await loadTranscriptions();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao finalizar.";
      appendLog(message, "error");
      if (fallbackToBatch && chunksRef.current.length > 0) {
        await uploadRecording(mimeType);
        return;
      }
      toast(message, "error");
      setPhase("idle");
    } finally {
      streamSessionRef.current = null;
    }
  }

  async function prepareAudioBlob(mimeType: string, durationSeconds: number): Promise<Blob> {
    let blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    if (mimeType.includes("webm") && durationSeconds > 0) {
      try {
        blob = await fixWebmDuration(blob, durationSeconds * 1000);
      } catch {
        // ignore
      }
    }
    return blob;
  }

  async function uploadRecording(mimeType: string) {
    setPhase("uploading");
    const durationSeconds = recordingSecondsRef.current;
    const blob = await prepareAudioBlob(mimeType, durationSeconds);

    if (blob.size === 0) {
      appendLog("Arquivo de áudio vazio.", "error");
      toast("Gravação vazia.", "error");
      setPhase("idle");
      return;
    }

    appendLog(`Áudio pronto: ${formatBytes(blob.size)}, ${durationSeconds}s.`);
    const formData = new FormData();
    formData.append("file", blob, `recording.${extensionForMime(mimeType)}`);
    formData.append("recording_duration_seconds", String(durationSeconds));
    if (isHybridMode) {
      formData.append("transcription_mode", "hybrid");
      const preview = liveTranscriptRef.current.trim();
      if (preview) {
        formData.append("live_transcript", preview);
      }
    }

    try {
      const res = await fetch(`/api/appointments/${appointmentId}/transcribe`, {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        error?: string;
        transcriptionId?: string;
        log?: string[];
      };

      if (Array.isArray(data.log)) {
        for (const line of data.log) appendLog(line, res.ok ? "info" : "error");
      }

      if (!res.ok) {
        appendLog(data.error ?? "Erro ao enviar áudio.", "error");
        setPhase("idle");
        return;
      }

      if (data.transcriptionId) {
        setActiveTranscriptionId(data.transcriptionId);
        setPhase("transcribing");
        await loadTranscriptions();
      } else {
        setPhase("idle");
      }
    } catch {
      appendLog("Erro de rede ao enviar áudio.", "error");
      setPhase("idle");
    }
  }

  const isRecordingActive =
    phase === "starting" || phase === "recording" || phase === "streaming";

  const isBusy =
    isRecordingActive ||
    phase === "uploading" ||
    phase === "transcribing" ||
    phase === "finalizing" ||
    phase === "post_processing";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Transcrição de áudio</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isHybridMode
            ? "Prévia quase instantânea enquanto você fala. Ao parar, o áudio vai para o Whisper na VPS e o relatório clínico é gerado."
            : isRealtimeMode
              ? "Grave a consulta com transcrição Whisper ao vivo na VPS. Ao finalizar, um relatório clínico é gerado."
              : "Grave o áudio da consulta e converta em texto. O áudio não é armazenado — apenas a transcrição."}
        </p>
      </div>

      {canRecord && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          {phase === "idle" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => void handleStartRecording()} disabled={isBusy}>
                <Mic className="h-4 w-4 mr-2" />
                Iniciar gravação
              </Button>
              {isRealtimeMode && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void runStreamingDiagnostics()}
                  disabled={isBusy}
                >
                  Testar API de streaming
                </Button>
              )}
            </div>
          )}

          {phase === "starting" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparando gravação…
                </div>
                <Button type="button" variant="outline" onClick={handleCancelStarting}>
                  Cancelar
                </Button>
              </div>
              <ClinicalAudioWaveform stream={audioPreviewStream} active />
              <p className="text-xs text-muted-foreground">
                Conectando ao serviço de transcrição. Isso pode levar alguns segundos.
              </p>
            </div>
          )}

          {(phase === "recording" || phase === "streaming") && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                  </span>
                  {phase === "streaming" ? "Ao vivo" : isHybridMode ? "Gravando" : "Gravando"}{" "}
                  {formatDuration(recordingSeconds)}
                </div>
                <Button type="button" variant="destructive" onClick={handleStopRecording}>
                  <Square className="h-4 w-4 mr-2 fill-current" />
                  Parar
                </Button>
              </div>

              <ClinicalAudioWaveform
                stream={audioPreviewStream}
                active={phase === "recording" || phase === "streaming"}
              />

              {(phase === "streaming" || isHybridMode) && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {isHybridMode
                      ? "Prévia do navegador (pode divergir). Texto definitivo após Whisper processar."
                      : "Texto aparece com pequeno atraso (~3–5s). Revise o conteúdo ao final."}
                  </p>
                  <Textarea
                    readOnly
                    value={liveTranscript}
                    placeholder={
                      isHybridMode
                        ? "Fale algo — a prévia aparece aqui quase na hora…"
                        : "A transcrição aparecerá aqui conforme você fala…"
                    }
                    className="min-h-[140px] resize-y bg-muted/30"
                  />
                </div>
              )}

              {phase === "recording" && !isHybridMode && (
                <p className="text-xs text-muted-foreground">
                  O áudio está sendo capturado. A transcrição completa será gerada ao parar a gravação.
                </p>
              )}
            </div>
          )}

          {(phase === "uploading" || phase === "finalizing") && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {phase === "finalizing" ? "Finalizando transcrição…" : "Enviando para transcrição…"}
            </div>
          )}

          {(phase === "transcribing" || phase === "post_processing") && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {phase === "post_processing"
                ? "Gerando diálogo e resumo clínico…"
                : "Transcrevendo… Isso pode levar alguns minutos."}
            </div>
          )}

          {activityLog.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Log do processo
              </p>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {activityLog.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-2 text-xs">
                    <LogIcon level={entry.level} />
                    <span
                      className={cn(
                        entry.level === "error" && "text-destructive",
                        entry.level === "success" && "text-green-700 dark:text-green-400"
                      )}
                    >
                      {entry.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Transcrições deste atendimento</h3>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        )}

        {!loading && transcriptions.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma transcrição ainda.</p>
        )}

        {!loading &&
          transcriptions.map((t) => (
            <div key={t.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</p>
                  {t.transcription_mode === "streaming" && (
                    <Badge variant="outline" className="text-[10px]">
                      Ao vivo VPS
                    </Badge>
                  )}
                  {t.transcription_mode === "hybrid" && (
                    <Badge variant="outline" className="text-[10px]">
                      Híbrido
                    </Badge>
                  )}
                </div>
                <Badge
                  variant={
                    t.status === "completed"
                      ? "secondary"
                      : t.status === "failed"
                        ? "destructive"
                        : "outline"
                  }
                  className="text-[10px]"
                >
                  {statusLabel(t.status, t.post_processing_status)}
                </Badge>
              </div>

              {(t.status === "processing" ||
                t.status === "queued" ||
                t.status === "streaming" ||
                t.post_processing_status === "pending" ||
                t.post_processing_status === "processing") && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.status === "streaming" && !isRecordingActive
                    ? "Gravação anterior interrompida — inicie uma nova ou aguarde limpeza."
                    : t.post_processing_status === "pending" ||
                        t.post_processing_status === "processing"
                      ? "Gerando relatório clínico…"
                      : "Transcrevendo…"}
                </div>
              )}

              {t.status === "failed" && t.error_message && (
                <p className="text-sm text-destructive">{t.error_message}</p>
              )}

              {(t.status === "completed" || t.live_transcript) && (
                <ClinicalTranscriptionDetail
                  transcript={t.transcript}
                  liveTranscript={t.live_transcript}
                  dialogue={t.dialogue ?? null}
                  clinicalSummary={t.clinical_summary ?? null}
                  postProcessingStatus={t.post_processing_status}
                  postProcessingError={t.post_processing_error}
                />
              )}

              {t.status === "completed" && t.duration_seconds != null && (
                <p className="text-xs text-muted-foreground">
                  Áudio: {Math.round(t.duration_seconds)}s
                  {t.summarized_at ? ` · Relatório: ${formatDateTime(t.summarized_at)}` : ""}
                </p>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
