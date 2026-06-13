export type AudioSource = "whatsapp" | "recording" | "other";
export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface TranscribeJob {
  job_id: string;
  status: JobStatus;
  text?: string | null;
  duration_seconds?: number | null;
  processing_time_seconds?: number | null;
  error_message?: string | null;
}

export interface TranscribeOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
}

const RETRYABLE_STATUSES = new Set([500, 502, 503]);
const RETRY_DELAYS_MS = [5000, 15000];

function getApiUrl(): string {
  return process.env.TRANSCRIBE_API_URL ?? "https://transcribe.viaprove.com.br";
}

function getApiKey(): string {
  const key = process.env.TRANSCRIBE_API_KEY;
  if (!key) {
    throw new Error("TRANSCRIBE_API_KEY não configurada no servidor.");
  }
  return key;
}

function getPollIntervalMs(): number {
  const raw = process.env.TRANSCRIBE_POLL_INTERVAL_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : 3000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;
}

function getTimeoutMs(source: AudioSource): number {
  if (source === "recording") {
    const raw = process.env.TRANSCRIBE_TIMEOUT_RECORDING_MS;
    const parsed = raw ? Number.parseInt(raw, 10) : 45 * 60 * 1000;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 45 * 60 * 1000;
  }
  const raw = process.env.TRANSCRIBE_TIMEOUT_WPP_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : 5 * 60 * 1000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 60 * 1000;
}

async function parseErrorResponse(res: Response): Promise<string> {
  const rawText = await res.text();
  try {
    const body = JSON.parse(rawText) as {
      detail?: string | Array<{ msg?: string; message?: string }>;
      message?: string;
      error?: string;
    };

    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      const parts = body.detail
        .map((item) => item.msg ?? item.message)
        .filter(Boolean);
      if (parts.length > 0) return parts.join("; ");
    }
    if (body.message) return body.message;
    if (body.error) return body.error;
    if (rawText.trim()) return rawText.slice(0, 500);
  } catch {
    if (rawText.trim()) return rawText.slice(0, 500);
  }
  return `Erro na API de transcrição (${res.status})`;
}

function mapHttpError(status: number, detail: string): Error {
  if (status === 400) {
    return new Error(
      detail || "Arquivo de áudio inválido, vazio ou muito grande (máx. 50 MB / 60 min)."
    );
  }
  if (status === 401) {
    return new Error("Configuração de transcrição inválida. Contate o administrador.");
  }
  if (status === 404) {
    return new Error("Job de transcrição não encontrado.");
  }
  if (status === 429) {
    return new Error("Limite de transcrições atingido. Aguarde um momento e tente novamente.");
  }
  return new Error(detail || `Erro na API de transcrição (${status})`);
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);

    if (res.ok || !RETRYABLE_STATUSES.has(res.status) || attempt === maxRetries) {
      return res;
    }

    const detail = await parseErrorResponse(res);
    lastError = mapHttpError(res.status, detail);
    const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    await new Promise((r) => setTimeout(r, delay));
  }

  throw lastError ?? new Error("Erro na API de transcrição.");
}

export async function createTranscriptionJob(
  audioBuffer: Buffer,
  filename: string,
  userId: string,
  source: AudioSource = "other",
  options?: { mimeType?: string; recordingDurationSeconds?: number }
): Promise<string> {
  const mimeType = options?.mimeType ?? "application/octet-stream";
  const form = new FormData();
  const arrayBuffer = new ArrayBuffer(audioBuffer.byteLength);
  new Uint8Array(arrayBuffer).set(audioBuffer);
  form.append("file", new Blob([arrayBuffer], { type: mimeType }), filename);
  form.append("user_id", userId);
  form.append("source", source);
  if (options?.recordingDurationSeconds != null) {
    form.append("recording_duration_seconds", String(options.recordingDurationSeconds));
  }

  const url = `${getApiUrl()}/v1/transcribe`;
  console.info("[Transcribe] create job request", {
    url,
    filename,
    mimeType,
    bytes: audioBuffer.byteLength,
    userId,
    source,
    recordingDurationSeconds: options?.recordingDurationSeconds ?? null,
  });

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${getApiKey()}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await parseErrorResponse(res);
    console.error("[Transcribe] create job failed", {
      status: res.status,
      detail,
      filename,
      bytes: audioBuffer.byteLength,
    });
    throw mapHttpError(res.status, detail);
  }

  const data = (await res.json()) as { job_id?: string; status?: string };
  if (!data.job_id) {
    console.error("[Transcribe] create job invalid response", data);
    throw new Error("Resposta inválida da API de transcrição (sem job_id).");
  }

  console.info("[Transcribe] create job ok", {
    job_id: data.job_id,
    status: data.status ?? null,
  });

  return data.job_id;
}

export async function getTranscriptionJob(jobId: string): Promise<TranscribeJob> {
  const res = await fetchWithRetry(`${getApiUrl()}/v1/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });

  if (!res.ok) {
    const detail = await parseErrorResponse(res);
    console.error("[Transcribe] get job failed", { jobId, status: res.status, detail });
    throw mapHttpError(res.status, detail);
  }

  const job = (await res.json()) as TranscribeJob;

  console.info("[Transcribe] get job", {
    job_id: job.job_id,
    status: job.status,
    duration_seconds: job.duration_seconds,
    processing_time_seconds: job.processing_time_seconds,
    has_text: Boolean(job.text?.trim()),
    error_message: job.error_message ?? null,
  });

  return job;
}

export async function transcribeAndWait(
  audioBuffer: Buffer,
  filename: string,
  userId: string,
  source: AudioSource = "other",
  options: TranscribeOptions = {}
): Promise<string> {
  const pollIntervalMs = options.pollIntervalMs ?? getPollIntervalMs();
  const timeoutMs = options.timeoutMs ?? getTimeoutMs(source);

  const jobId = await createTranscriptionJob(audioBuffer, filename, userId, source);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const job = await getTranscriptionJob(jobId);

    if (job.status === "completed") {
      const text = (job.text ?? "").trim();
      if (!text) {
        throw new Error("Transcrição concluída, mas o texto está vazio.");
      }
      return text;
    }

    if (job.status === "failed") {
      throw new Error(job.error_message || "Transcrição falhou.");
    }
  }

  throw new Error(
    `Transcrição expirou após ${Math.round(timeoutMs / 1000)}s (job_id: ${jobId}).`
  );
}
