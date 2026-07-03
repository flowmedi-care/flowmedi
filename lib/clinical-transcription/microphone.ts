export function getMicrophoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Permissão do microfone negada. Clique no ícone de cadeado/câmera na barra de endereço, permita o microfone e recarregue a página. Se já bloqueou antes, vá em Configurações do site → Microfone → Permitir.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "Nenhum microfone encontrado. Conecte um microfone e tente novamente.";
      case "NotReadableError":
      case "TrackStartError":
        return "O microfone está em uso por outro aplicativo. Feche outros programas que usem áudio.";
      case "OverconstrainedError":
        return "Não foi possível usar o microfone com as configurações solicitadas.";
      case "SecurityError":
        return "Acesso ao microfone bloqueado. Use HTTPS ou localhost.";
      default:
        return error.message || "Não foi possível acessar o microfone.";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Não foi possível acessar o microfone.";
}

export function assertMicrophoneSupported(): string | null {
  if (typeof window === "undefined") {
    return "Ambiente sem suporte a microfone.";
  }
  if (!window.isSecureContext) {
    return "O microfone só funciona em HTTPS ou localhost. Acesse o site com conexão segura.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "Seu navegador não suporta captura de áudio.";
  }
  return null;
}

export async function requestMicrophoneStream(): Promise<MediaStream> {
  const unsupported = assertMicrophoneSupported();
  if (unsupported) {
    throw new Error(unsupported);
  }

  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
}

export function createMediaRecorder(stream: MediaStream, preferredMime?: string): MediaRecorder {
  const candidates = preferredMime
    ? [preferredMime, "audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

  const tried = new Set<string>();
  for (const mime of candidates) {
    if (!mime || tried.has(mime)) continue;
    tried.add(mime);
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
      try {
        return new MediaRecorder(stream, { mimeType: mime });
      } catch {
        // try next
      }
    }
  }

  return new MediaRecorder(stream);
}

/** Inicia gravação sem chamar start() duas vezes se o navegador já entrou em "recording". */
export function startMediaRecorder(recorder: MediaRecorder, timesliceMs?: number): void {
  if (recorder.state !== "inactive") {
    return;
  }

  if (timesliceMs != null && timesliceMs > 0) {
    try {
      recorder.start(timesliceMs);
      return;
    } catch {
      if (recorder.state === "recording") {
        return;
      }
    }
  }

  if (recorder.state === "inactive") {
    recorder.start();
  }
}

export function stopMediaRecorder(recorder: MediaRecorder | null | undefined): void {
  if (!recorder || recorder.state === "inactive") return;
  try {
    recorder.stop();
  } catch {
    // ignore
  }
}
