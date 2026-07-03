import type { TranscriptSegment } from "@/lib/clinical-transcription/types";

export type StreamWsServerMessage =
  | { type: "ready"; session_id?: string }
  | { type: "partial"; text: string; start?: number; end?: number }
  | { type: "segment_final"; text: string; start?: number; end?: number; segment_index?: number }
  | { type: "session_complete"; full_text: string; duration_seconds?: number; segment_count?: number }
  | { type: "error"; code?: string; message: string };

export type StreamConnectionCallbacks = {
  onPartial: (text: string) => void;
  onSegmentFinal: (segment: TranscriptSegment) => void;
  onSessionComplete: (fullText: string, durationSeconds?: number) => void;
  onError: (message: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

export class ClinicalStreamConnection {
  private ws: WebSocket | null = null;
  private closed = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;

  constructor(
    private readonly wsUrl: string,
    private readonly mimeType: string,
    private readonly callbacks: StreamConnectionCallbacks
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.closed = false;
      this.ws = new WebSocket(this.wsUrl);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.sendJson({ type: "start", mime: this.mimeType, sample_rate: 48000 });
        this.callbacks.onOpen?.();
        resolve();
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        try {
          const payload = JSON.parse(event.data) as StreamWsServerMessage;
          this.handleMessage(payload);
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onerror = () => {
        const message = "Erro na conexão de streaming.";
        this.callbacks.onError(message);
        reject(new Error(message));
      };

      this.ws.onclose = () => {
        this.callbacks.onClose?.();
        if (!this.closed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts += 1;
        }
      };
    });
  }

  sendAudioChunk(chunk: Blob): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    void chunk.arrayBuffer().then((buffer) => {
      this.ws?.send(buffer);
    });
  }

  async end(): Promise<void> {
    this.closed = true;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendJson({ type: "end" });
    }
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }

  private sendJson(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  private handleMessage(payload: StreamWsServerMessage): void {
    switch (payload.type) {
      case "partial":
        if (payload.text) this.callbacks.onPartial(payload.text);
        break;
      case "segment_final":
        if (payload.text) {
          this.callbacks.onSegmentFinal({
            start: payload.start ?? 0,
            end: payload.end ?? 0,
            text: payload.text,
            is_final: true,
            segment_index: payload.segment_index,
          });
        }
        break;
      case "session_complete":
        this.callbacks.onSessionComplete(payload.full_text, payload.duration_seconds);
        break;
      case "error":
        this.callbacks.onError(payload.message);
        break;
      default:
        break;
    }
  }
}

export function buildLiveTranscriptFromSegments(segments: TranscriptSegment[]): string {
  return segments
    .filter((s) => s.is_final)
    .map((s) => s.text)
    .join(" ")
    .trim();
}
