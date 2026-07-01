import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "whatsapp-media";

export const WHATSAPP_MEDIA_BUCKET = BUCKET;

/**
 * Obtém a URL da mídia da API Meta e faz upload para o Supabase Storage.
 * As URLs da Meta expiram em ~5 min, então é necessário persistir.
 */
export async function fetchAndStoreWhatsAppMedia(
  mediaId: string,
  accessToken: string,
  supabase: SupabaseClient,
  options: { clinicId: string; mediaId: string; mimeType?: string }
): Promise<string | null> {
  try {
    // 1. Obter URL temporária da Meta
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
      console.error("[WhatsApp Media] Meta API error:", metaRes.status, await metaRes.text());
      return null;
    }
    const metaData = (await metaRes.json()) as { url?: string; mime_type?: string };
    const mediaUrl = metaData.url;
    if (!mediaUrl) {
      console.error("[WhatsApp Media] No URL in Meta response");
      return null;
    }

    // 2. Baixar o arquivo (URL da Meta exige Bearer token)
    const downloadRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!downloadRes.ok) {
      console.error("[WhatsApp Media] Download failed:", downloadRes.status);
      return null;
    }
    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const rawContentType =
      metaData.mime_type || downloadRes.headers.get("content-type") || "application/octet-stream";
    const contentType = normalizeMimeType(rawContentType);

    const sniffed = sniffAudioFromBuffer(buffer);
    const ext =
      sniffed && !sniffed.unsupported
        ? sniffed.ext
        : getExtensionFromMime(contentType);
    const path = `${options.clinicId}/${options.mediaId.replace(/[^a-zA-Z0-9.-]/g, "_")}${ext}`;

    // 4. Upload para Supabase
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error("[WhatsApp Media] Upload error:", error.message);
      return null;
    }

    return data.path;
  } catch (err) {
    console.error("[WhatsApp Media] Error:", err);
    return null;
  }
}

const TRANSCRIBE_AUDIO_EXTENSIONS = new Set([
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".ogg",
  ".opus",
  ".wav",
  ".webm",
]);

export type SniffedAudioFormat = {
  ext: string;
  mimeType: string;
  /** Formato reconhecido mas não aceito pela API de transcrição */
  unsupported?: boolean;
  unsupportedReason?: string;
};

/** Detecta formato real pelo conteúdo do arquivo (mais confiável que o MIME da Meta). */
export function sniffAudioFromBuffer(buffer: Buffer): SniffedAudioFormat | null {
  if (buffer.length < 12) return null;

  const head4 = buffer.subarray(0, 4).toString("ascii");
  const head5 = buffer.subarray(0, 5).toString("ascii");

  if (head4 === "OggS") {
    return { ext: ".ogg", mimeType: "audio/ogg" };
  }
  if (head5 === "#!AMR") {
    return {
      ext: ".amr",
      mimeType: "audio/amr",
      unsupported: true,
      unsupportedReason:
        "Áudio AMR não é suportado pela transcrição. Peça ao paciente para enviar por texto ou gravar novamente.",
    };
  }
  if (head4 === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE") {
    return { ext: ".wav", mimeType: "audio/wav" };
  }
  if (head4 === "fLaC") {
    return { ext: ".flac", mimeType: "audio/flac" };
  }
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return { ext: ".m4a", mimeType: "audio/mp4" };
  }
  if (head4 === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
    return { ext: ".mp3", mimeType: "audio/mpeg" };
  }
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return { ext: ".webm", mimeType: "audio/webm" };
  }
  return null;
}

function isLikelyHtmlBuffer(buffer: Buffer): boolean {
  const start = buffer.subarray(0, 64).toString("utf8").trimStart().toLowerCase();
  return start.startsWith("<!doctype") || start.startsWith("<html") || start.startsWith("<?xml");
}

/** Remove parâmetros do MIME (ex.: "audio/ogg; codecs=opus" → "audio/ogg"). */
export function normalizeMimeType(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

export function getExtensionFromMime(mime: string): string {
  const base = normalizeMimeType(mime);
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "audio/ogg": ".ogg",
    "audio/opus": ".opus",
    "audio/aac": ".aac",
    "audio/x-aac": ".aac",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/m4a": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/webm": ".webm",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/flac": ".flac",
    "audio/amr": ".amr",
    "audio/3gpp": ".3gp",
  };

  if (map[base]) return map[base];
  if (base.startsWith("audio/")) return ".ogg";
  if (base.startsWith("video/")) return ".webm";
  if (base.startsWith("image/")) return ".jpg";
  return ".bin";
}

function extensionFromMediaUrl(mediaUrl: string): string | null {
  const match = mediaUrl.match(/\.(aac|flac|m4a|mp3|ogg|opus|wav|webm)(\?|$)/i);
  if (!match) return null;
  const ext = `.${match[1].toLowerCase()}`;
  return TRANSCRIBE_AUDIO_EXTENSIONS.has(ext) ? ext : null;
}

/** Nome e MIME para envio à API de transcrição (somente extensões permitidas). */
export function getTranscribeAudioFile(
  messageId: string,
  mimeType: string | null | undefined,
  mediaUrl?: string | null,
  buffer?: Buffer | null
): { filename: string; mimeType: string; unsupported?: string } {
  if (buffer && buffer.length > 0) {
    if (isLikelyHtmlBuffer(buffer)) {
      return {
        filename: `whatsapp-${messageId}.ogg`,
        mimeType: "audio/ogg",
        unsupported:
          "Não foi possível baixar o áudio (resposta inválida do storage). Verifique o acesso ao arquivo.",
      };
    }
    if (buffer.length < 100) {
      return {
        filename: `whatsapp-${messageId}.ogg`,
        mimeType: "audio/ogg",
        unsupported: `Arquivo de áudio muito pequeno (${buffer.length} bytes).`,
      };
    }

    const sniffed = sniffAudioFromBuffer(buffer);
    if (sniffed) {
      if (sniffed.unsupported) {
        return {
          filename: `whatsapp-${messageId}${sniffed.ext}`,
          mimeType: sniffed.mimeType,
          unsupported: sniffed.unsupportedReason ?? "Formato de áudio não suportado.",
        };
      }
      return {
        filename: `whatsapp-${messageId}${sniffed.ext}`,
        mimeType: sniffed.mimeType,
      };
    }
  }

  let normalized = normalizeMimeType(mimeType?.trim() || "audio/ogg");
  let ext = getExtensionFromMime(normalized);

  const urlExt = mediaUrl ? extensionFromMediaUrl(mediaUrl) : null;
  if (urlExt) ext = urlExt;

  if (!TRANSCRIBE_AUDIO_EXTENSIONS.has(ext)) {
    ext = ".ogg";
    normalized = "audio/ogg";
  }

  const mimeForBlob =
    normalized.startsWith("audio/") && getExtensionFromMime(normalized) === ext
      ? normalized
      : `audio/${ext.slice(1)}`;

  return {
    filename: `whatsapp-${messageId}${ext}`,
    mimeType: mimeForBlob,
  };
}
