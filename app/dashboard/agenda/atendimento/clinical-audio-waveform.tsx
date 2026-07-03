"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type ClinicalAudioWaveformProps = {
  stream: MediaStream | null;
  active: boolean;
  className?: string;
};

export function ClinicalAudioWaveform({ stream, active, className }: ClinicalAudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!stream || !active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let cancelled = false;

    const setup = async () => {
      try {
        audioContext = new AudioContext();
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.82;
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.fftSize;
        const timeData = new Uint8Array(bufferLength);
        const freqData = new Uint8Array(analyser.frequencyBinCount);

        const draw = () => {
          if (cancelled || !analyser || !context) return;
          rafRef.current = requestAnimationFrame(draw);

          const rect = canvas.getBoundingClientRect();
          const width = Math.max(1, Math.floor(rect.width));
          const height = Math.max(1, Math.floor(rect.height));
          const dpr = window.devicePixelRatio || 1;
          if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
          }

          context.clearRect(0, 0, width, height);

          analyser.getByteTimeDomainData(timeData);
          analyser.getByteFrequencyData(freqData);

          // Fundo suave
          context.fillStyle = "hsl(var(--muted) / 0.35)";
          context.fillRect(0, 0, width, height);

          // Barras de frequência
          const barCount = 48;
          const step = Math.max(1, Math.floor(freqData.length / barCount));
          const barWidth = width / barCount - 2;
          let hasSignal = false;

          for (let i = 0; i < barCount; i += 1) {
            let sum = 0;
            for (let j = 0; j < step; j += 1) {
              sum += freqData[i * step + j] ?? 0;
            }
            const avg = sum / step;
            if (avg > 8) hasSignal = true;
            const barHeight = Math.max(4, (avg / 255) * (height * 0.72));
            const x = i * (barWidth + 2) + 1;
            const y = (height - barHeight) / 2;

            const gradient = context.createLinearGradient(0, y, 0, y + barHeight);
            gradient.addColorStop(0, "hsl(var(--primary) / 0.95)");
            gradient.addColorStop(1, "hsl(var(--primary) / 0.35)");
            context.fillStyle = gradient;
            context.fillRect(x, y, barWidth, barHeight);
          }

          // Linha de onda
          context.lineWidth = 2;
          context.strokeStyle = hasSignal
            ? "hsl(var(--destructive) / 0.9)"
            : "hsl(var(--muted-foreground) / 0.35)";
          context.beginPath();

          const sliceWidth = width / bufferLength;
          let x = 0;
          for (let i = 0; i < bufferLength; i += 1) {
            const v = (timeData[i] ?? 128) / 128.0;
            const y = (v * height) / 2;
            if (i === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
            x += sliceWidth;
          }
          context.stroke();

          if (!hasSignal) {
            context.fillStyle = "hsl(var(--muted-foreground) / 0.7)";
            context.font = "12px system-ui, sans-serif";
            context.textAlign = "center";
            context.fillText("Fale algo para ver o nível do áudio…", width / 2, height / 2 + 4);
          }
        };

        draw();
      } catch {
        // visualização opcional — não bloqueia gravação
      }
    };

    void setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      source?.disconnect();
      analyser?.disconnect();
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close();
      }
    };
  }, [stream, active]);

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/20 overflow-hidden",
        active && "ring-1 ring-destructive/30",
        className
      )}
    >
      <canvas ref={canvasRef} className="w-full h-24 block" aria-hidden />
    </div>
  );
}
