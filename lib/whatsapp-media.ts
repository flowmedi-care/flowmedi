import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "whatsapp-media";

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
    const contentType = metaData.mime_type || downloadRes.headers.get("content-type") || "application/octet-stream";

    // 3. Gerar extensão e path
    const ext = getExtensionFromMime(contentType);
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

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return publicUrl;
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
    // AMR não é aceito pela API de transcrição — tentar como ogg (Meta costuma ser opus/ogg)
    "audio/amr": ".ogg",
    "audio/3gpp": ".m4a",
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
  mediaUrl?: string | null
): { filename: string; mimeType: string } {
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
