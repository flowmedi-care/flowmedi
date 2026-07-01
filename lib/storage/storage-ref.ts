export type StorageRef = { bucket: string; path: string };

export function buildStorageRef(bucket: string, path: string): StorageRef {
  return { bucket, path };
}

/** Normaliza path relativo ou URL pública legada do Supabase Storage. */
export function toStoragePath(bucket: string, pathOrLegacyUrl: string): string | null {
  const raw = pathOrLegacyUrl.trim();
  if (!raw) return null;

  if (raw.startsWith("/dashboard")) return null;

  if (!raw.startsWith("http") && !raw.startsWith("/storage")) {
    return raw.replace(/^\/+/, "");
  }

  const publicPattern = new RegExp(
    `/storage/v1/object/public/${bucket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(.+)$`
  );
  const publicMatch = raw.match(publicPattern);
  if (publicMatch) return publicMatch[1];

  const bucketPattern = new RegExp(
    `${bucket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(.+)$`
  );
  const bucketMatch = raw.match(bucketPattern);
  if (bucketMatch) return bucketMatch[1];

  return null;
}

export function isStoragePath(value: string | null | undefined): boolean {
  if (!value) return false;
  return !value.startsWith("http") && !value.startsWith("/dashboard") && !value.startsWith("/storage");
}
