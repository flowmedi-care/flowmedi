import { headers } from "next/headers";
import { extractClinicSubdomain } from "./host";

/** Detecta se o request atual está no subdomínio da clínica (server-only). */
export async function isOnClinicSubdomain(): Promise<boolean> {
  const headersList = await headers();
  return !!extractClinicSubdomain(headersList.get("host") ?? "");
}
