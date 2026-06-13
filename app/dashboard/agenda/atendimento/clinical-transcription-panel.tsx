"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import fixWebmDuration from "fix-webm-duration";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2, Mic, Square, XCircle } from "lucide-react";

type TranscriptionRecord = {
  id: string;
  status: string;
  transcript: string | null;
  error_message: string | null;
  duration_seconds: number | null;
  processing_time_seconds: number | null;
  created_at: string;
  completed_at: string | null;
};

type PanelPhase = "idle" | "recording" | "uploading" | "transcribing";

type LogEntry = {
  id: string;
  message: string;
  level: "info" | "success" | "error";
};

const POLL_INTERVAL_MS = 3000;

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

function statusLabel(status: string): string {
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
}: {
  appointmentId: string;
  canRecord: boolean;
}) {
  const [transcriptions, setTranscriptions] = useState<TranscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<PanelPhase>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeTranscriptionId, setActiveTranscriptionId] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<LogEntry[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingSecondsRef = useRef(0);
  const logIdRef = useRef(0);

  const appendLog = useCallback((message: string, level: LogEntry["level"] = "info") => {
    logIdRef.current += 1;
    setActivityLog((prev) => [
      ...prev,
      { id: String(logIdRef.current), message, level },
    ]);
  }, []);

  const clearActivityLog = useCallback(() => {
    setActivityLog([]);
  }, []);

  const stopMediaTracks = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
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
        (t) => t.status === "processing" || t.status === "queued"
      );
      if (inProgress) {
        setActiveTranscriptionId(inProgress.id);
        setPhase("transcribing");
      }
    } catch {
      toast("Erro ao carregar transcrições.", "error");
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  const pollTranscription = useCallback(
    async (transcriptionId: string, pollCount = 0) => {
      try {
        if (pollCount === 0) {
          appendLog("Consultando status na API de transcrição…");
        } else if (pollCount % 5 === 0) {
          appendLog(`Ainda transcrevendo… (${pollCount * (POLL_INTERVAL_MS / 1000)}s)`);
        }

        const res = await fetch(`/api/transcribe/jobs/${transcriptionId}`);
        const data = (await res.json()) as {
          error?: string;
          status?: string;
          transcript?: string | null;
          error_message?: string | null;
          duration_seconds?: number | null;
          processing_time_seconds?: number | null;
        };

        if (!res.ok) {
          appendLog(data.error ?? "Erro ao consultar transcrição.", "error");
          toast(data.error ?? "Erro ao consultar transcrição.", "error");
          setPhase("idle");
          setActiveTranscriptionId(null);
          await loadTranscriptions();
          return;
        }

        if (data.status === "completed") {
          appendLog("Transcrição concluída com sucesso.", "success");
          if (data.duration_seconds != null) {
            appendLog(
              `Áudio: ${Math.round(data.duration_seconds)}s · Processamento: ${Math.round(data.processing_time_seconds ?? 0)}s`,
              "success"
            );
          }
          toast("Transcrição concluída.", "success");
          setPhase("idle");
          setActiveTranscriptionId(null);
          await loadTranscriptions();
          return;
        }

        if (data.status === "failed") {
          appendLog(data.error_message ?? "Transcrição falhou.", "error");
          toast(data.error_message ?? "Transcrição falhou.", "error");
          setPhase("idle");
          setActiveTranscriptionId(null);
          await loadTranscriptions();
          return;
        }

        appendLog(`Status: ${data.status ?? "processando"}…`);

        pollTimerRef.current = setTimeout(() => {
          void pollTranscription(transcriptionId, pollCount + 1);
        }, POLL_INTERVAL_MS);
      } catch {
        appendLog("Erro de rede ao consultar transcrição.", "error");
        toast("Erro ao consultar transcrição.", "error");
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
    if (phase === "transcribing" && activeTranscriptionId) {
      clearPollTimer();
      void pollTranscription(activeTranscriptionId);
    }
    return () => clearPollTimer();
  }, [phase, activeTranscriptionId, pollTranscription, clearPollTimer]);

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      clearPollTimer();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      stopMediaTracks();
    };
  }, [clearRecordingTimer, clearPollTimer, stopMediaTracks]);

  async function handleStartRecording() {
    if (!canRecord) return;

    clearActivityLog();
    appendLog("Solicitando acesso ao microfone…");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      appendLog(`Microfone ok. Formato: ${mimeType ?? "padrão do navegador"}.`);

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        clearRecordingTimer();
        stopMediaTracks();
        void uploadRecording(recorder.mimeType || mimeType || "audio/webm");
      };

      recorder.start(1000);
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      setPhase("recording");
      appendLog("Gravação iniciada.");
      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
    } catch {
      appendLog("Microfone bloqueado ou indisponível.", "error");
      toast("Não foi possível acessar o microfone. Verifique as permissões do navegador.", "error");
      stopMediaTracks();
      setPhase("idle");
    }
  }

  function handleStopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") {
      appendLog(`Gravação finalizada (${formatDuration(recordingSecondsRef.current)}).`);
      try {
        recorder.requestData();
      } catch {
        // ignore — nem todo browser suporta
      }
      recorder.stop();
    } else {
      setPhase("idle");
      stopMediaTracks();
    }
  }

  async function prepareAudioBlob(mimeType: string, durationSeconds: number): Promise<Blob> {
    let blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];

    if (mimeType.includes("webm") && durationSeconds > 0) {
      appendLog("Corrigindo metadados de duração do WebM…");
      try {
        blob = await fixWebmDuration(blob, durationSeconds * 1000);
        appendLog("Metadados de duração corrigidos.", "success");
      } catch {
        appendLog("Não foi possível corrigir duração do WebM; enviando mesmo assim.", "error");
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
      toast("Gravação vazia. Tente novamente.", "error");
      setPhase("idle");
      return;
    }

    appendLog(`Áudio pronto: ${formatBytes(blob.size)}, ${durationSeconds}s.`);

    const ext = extensionForMime(mimeType);
    const formData = new FormData();
    formData.append("file", blob, `recording.${ext}`);
    formData.append("recording_duration_seconds", String(durationSeconds));

    appendLog("Enviando para transcrição…");

    try {
      const res = await fetch(`/api/appointments/${appointmentId}/transcribe`, {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        error?: string;
        transcriptionId?: string;
        status?: string;
        jobId?: string;
        log?: string[];
      };

      if (Array.isArray(data.log)) {
        for (const line of data.log) {
          appendLog(line, res.ok ? "info" : "error");
        }
      }

      if (!res.ok) {
        appendLog(data.error ?? "Erro ao enviar áudio.", "error");
        toast(data.error ?? "Erro ao enviar áudio.", "error");
        setPhase("idle");
        await loadTranscriptions();
        return;
      }

      appendLog("Enviado com sucesso. Aguardando transcrição…", "success");

      if (data.transcriptionId) {
        setActiveTranscriptionId(data.transcriptionId);
        setPhase("transcribing");
        await loadTranscriptions();
      } else {
        setPhase("idle");
      }
    } catch {
      appendLog("Erro de rede ao enviar áudio.", "error");
      toast("Erro ao enviar áudio.", "error");
      setPhase("idle");
    }
  }

  const isBusy = phase === "uploading" || phase === "transcribing";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Transcrição de áudio</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Grave o áudio da consulta e converta em texto. O áudio não é armazenado — apenas a
          transcrição.
        </p>
      </div>

      {canRecord && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          {phase === "idle" && (
            <Button type="button" onClick={() => void handleStartRecording()} disabled={isBusy}>
              <Mic className="h-4 w-4 mr-2" />
              Iniciar gravação
            </Button>
          )}

          {phase === "recording" && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                </span>
                Gravando {formatDuration(recordingSeconds)}
              </div>
              <Button type="button" variant="destructive" onClick={handleStopRecording}>
                <Square className="h-4 w-4 mr-2 fill-current" />
                Parar e transcrever
              </Button>
            </div>
          )}

          {phase === "uploading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando para transcrição…
            </div>
          )}

          {phase === "transcribing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Transcrevendo… Isso pode levar alguns minutos para áudios longos.
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

      {!canRecord && (
        <p className="text-sm text-muted-foreground">
          Apenas profissionais autorizados podem gravar e transcrever áudio neste atendimento.
        </p>
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
                <p className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</p>
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
                  {statusLabel(t.status)}
                </Badge>
              </div>

              {(t.status === "processing" || t.status === "queued") && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transcrevendo…
                </div>
              )}

              {t.status === "failed" && t.error_message && (
                <p className="text-sm text-destructive">{t.error_message}</p>
              )}

              {t.status === "completed" && t.transcript && (
                <Textarea
                  readOnly
                  value={t.transcript}
                  className={cn("min-h-[120px] resize-y bg-muted/30")}
                />
              )}

              {t.status === "completed" &&
                (t.duration_seconds != null || t.processing_time_seconds != null) && (
                  <p className="text-xs text-muted-foreground">
                    {t.duration_seconds != null &&
                      `Áudio: ${Math.round(t.duration_seconds)}s`}
                    {t.duration_seconds != null && t.processing_time_seconds != null && " · "}
                    {t.processing_time_seconds != null &&
                      `Processamento: ${Math.round(t.processing_time_seconds)}s`}
                  </p>
                )}
            </div>
          ))}
      </div>
    </div>
  );
}
