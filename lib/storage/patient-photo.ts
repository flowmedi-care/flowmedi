import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuthenticatedSignedUrl } from "./signed-url";

const BUCKET = "patient-photos";

/** Extrai path de storage a partir de valor legado (URL pública) ou path relativo. */
export function patientPhotoStoragePath(photoUrl: string | null | undefined): string | null {
  if (!photoUrl?.trim()) return null;
  const v = photoUrl.trim();
  if (v.startsWith("http")) {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = v.indexOf(marker);
    if (idx >= 0) return decodeURIComponent(v.slice(idx + marker.length));
    const signedMarker = `/storage/v1/object/sign/${BUCKET}/`;
    const sidx = v.indexOf(signedMarker);
    if (sidx >= 0) {
      const rest = v.slice(sidx + signedMarker.length);
      return decodeURIComponent(rest.split("?")[0] ?? rest);
    }
    return null;
  }
  return v;
}

export async function resolvePatientPhotoDisplayUrl(
  supabase: SupabaseClient,
  photoUrl: string | null | undefined
): Promise<string | null> {
  const path = patientPhotoStoragePath(photoUrl);
  if (!path) return null;
  if (photoUrl?.startsWith("http") && !photoUrl.includes(`/object/sign/${BUCKET}/`)) {
    return photoUrl;
  }
  const { url } = await createAuthenticatedSignedUrl(supabase, BUCKET, path, 3600);
  return url;
}

export function patientPhotoObjectPath(
  clinicId: string,
  patientId: string,
  ext: string
): string {
  return `${clinicId}/${patientId}/avatar.${ext}`;
}

export { BUCKET as PATIENT_PHOTOS_BUCKET };
