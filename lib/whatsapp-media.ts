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

function getExtensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/webm": ".webm",
    "audio/amr": ".amr",
  };
  return map[mime] ?? ".bin";
}
