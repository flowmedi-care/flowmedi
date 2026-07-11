import { NextResponse } from "next/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { loadPlaygroundCatalog } from "@/lib/virtual-assistant/tools/playground-catalog";

export async function GET() {
  try {
    const { clinicId } = await requireClinicAdminApi();
    const supabase = await createClient();
    const catalog = await loadPlaygroundCatalog(supabase, clinicId);
    return NextResponse.json(catalog);
  } catch (e) {
    if (e instanceof ApiAuthError) return toApiErrorResponse(e);
    const message = e instanceof Error ? e.message : "Erro ao carregar catálogo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
