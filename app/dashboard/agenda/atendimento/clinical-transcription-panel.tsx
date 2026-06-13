"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Loader2, Mic, Square } from "lucide-react";

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    async (transcriptionId: string) => {
      try {
        const res = await fetch(`/api/transcribe/jobs/${transcriptionId}`);
        const data = (await res.json()) as {
          error?: string;
          status?: string;
          transcript?: string | null;
          error_message?: string | null;
        };

        if (!res.ok) {
          toast(data.error ?? "Erro ao consultar transcrição.", "error");
          setPhase("idle");
          setActiveTranscriptionId(null);
          await loadTranscriptions();
          return;
        }

        if (data.status === "completed") {
          toast("Transcrição concluída.", "success");
          setPhase("idle");
          setActiveTranscriptionId(null);
          await loadTranscriptions();
          return;
        }

        if (data.status === "failed") {
          toast(data.error_message ?? "Transcrição falhou.", "error");
          setPhase("idle");
          setActiveTranscriptionId(null);
          await loadTranscriptions();
          return;
        }

        pollTimerRef.current = setTimeout(() => {
          void pollTranscription(transcriptionId);
        }, POLL_INTERVAL_MS);
      } catch {
        toast("Erro ao consultar transcrição.", "error");
        setPhase("idle");
        setActiveTranscriptionId(null);
      }
    },
    [loadTranscriptions]
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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
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
      setRecordingSeconds(0);
      setPhase("recording");
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      toast("Não foi possível acessar o microfone. Verifique as permissões do navegador.", "error");
      stopMediaTracks();
      setPhase("idle");
    }
  }

  function handleStopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    } else {
      setPhase("idle");
      stopMediaTracks();
    }
  }

  async function uploadRecording(mimeType: string) {
    setPhase("uploading");

    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];

    if (blob.size === 0) {
      toast("Gravação vazia. Tente novamente.", "error");
      setPhase("idle");
      return;
    }

    const ext = extensionForMime(mimeType);
    const formData = new FormData();
    formData.append("file", blob, `recording.${ext}`);

    try {
      const res = await fetch(`/api/appointments/${appointmentId}/transcribe`, {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        error?: string;
        transcriptionId?: string;
        status?: string;
      };

      if (!res.ok) {
        toast(data.error ?? "Erro ao enviar áudio.", "error");
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
              Enviando áudio…
            </div>
          )}

          {phase === "transcribing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Transcrevendo… Isso pode levar alguns minutos para áudios longos.
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
