export type SpeechPreviewCallbacks = {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
};

type PreviewSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: {
    isFinal: boolean;
    [index: number]: { transcript?: string };
  };
};

function getSpeechRecognitionCtor(): (new () => PreviewSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => PreviewSpeechRecognition;
    webkitSpeechRecognition?: new () => PreviewSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechPreviewSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

/** Prévia ao vivo via Web Speech API (navegador). Texto definitivo vem do Whisper após parar. */
export class ClinicalSpeechPreview {
  private recognition: PreviewSpeechRecognition | null = null;
  private running = false;
  private fullText = "";

  constructor(
    private readonly callbacks: SpeechPreviewCallbacks,
    private readonly lang = "pt-BR"
  ) {}

  start(): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      this.callbacks.onError("Seu navegador não suporta prévia de voz.");
      return;
    }

    this.recognition = new Ctor();
    this.recognition.lang = this.lang;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        if (result.isFinal) {
          this.fullText = `${this.fullText} ${text}`.trim();
          this.callbacks.onFinal(this.fullText);
        } else {
          interim = `${interim} ${text}`.trim();
        }
      }
      if (interim) {
        this.callbacks.onInterim(`${this.fullText} ${interim}`.trim());
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      this.callbacks.onError(`Prévia de voz: ${event.error}`);
    };

    this.recognition.onend = () => {
      if (!this.running || !this.recognition) return;
      try {
        this.recognition.start();
      } catch {
        // ignore restart race
      }
    };

    this.running = true;
    this.fullText = "";
    this.recognition.start();
  }

  stop(): void {
    this.running = false;
    try {
      this.recognition?.stop();
    } catch {
      // ignore
    }
    this.recognition = null;
  }

  getText(): string {
    return this.fullText;
  }
}
