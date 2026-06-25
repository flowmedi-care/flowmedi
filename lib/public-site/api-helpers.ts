import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { PublicClinicSiteResponse } from "./types";
import { loadPublicClinicSiteWithServiceRole } from "./load-site";
import { checkPublicBookingReadiness } from "./booking-readiness";

export async function resolvePublicBookingContext(slug: string) {
  const supabase = createServiceRoleClient();
  const site = await loadPublicClinicSiteWithServiceRole(supabase, slug);

  if (!site.found) {
    return { error: "Site não encontrado.", status: 404 as const, supabase, site: null };
  }

  const readiness = checkPublicBookingReadiness(site);
  if (!readiness.available) {
    return { error: readiness.reason ?? "Agendamento indisponível.", status: 403 as const, supabase, site };
  }

  return { error: null, status: 200 as const, supabase, site };
}

export type ResolvedPublicSite = Extract<PublicClinicSiteResponse, { found: true }>;
