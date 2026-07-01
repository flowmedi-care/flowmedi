import type { SupabaseClient } from "@supabase/supabase-js";
import { toStoragePath } from "./storage-ref";

export async function createAuthenticatedSignedUrl(
  supabase: SupabaseClient,
  bucket: string,
  pathOrLegacyUrl: string,
  ttlSeconds = 3600
): Promise<{ url: string | null; error: string | null }> {
  const path = toStoragePath(bucket, pathOrLegacyUrl);
  if (!path) {
    return { url: null, error: "Path de arquivo inválido." };
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds);

  if (error || !data?.signedUrl) {
    return { url: null, error: error?.message ?? "Erro ao gerar URL do arquivo." };
  }

  return { url: data.signedUrl, error: null };
}

export async function downloadStorageObject(
  supabase: SupabaseClient,
  bucket: string,
  pathOrLegacyUrl: string
): Promise<{ buffer: Buffer | null; error: string | null }> {
  const path = toStoragePath(bucket, pathOrLegacyUrl);
  if (!path) {
    return { buffer: null, error: "Path de arquivo inválido." };
  }

  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    return { buffer: null, error: error?.message ?? "Erro ao baixar arquivo." };
  }

  const arrayBuffer = await data.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), error: null };
}
