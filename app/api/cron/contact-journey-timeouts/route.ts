import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runContactJourneyTimeouts } from "@/lib/contact-journey/timeout-executor";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * Cron: follow-ups e ações de timeout por journey step (sem resposta).
 * GET /api/cron/contact-journey-timeouts?secret=...
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const supabase = createServiceRoleClient();
  const clinicId = request.nextUrl.searchParams.get("clinic_id") || undefined;

  const result = await runContactJourneyTimeouts(supabase, clinicId ?? undefined);
  return NextResponse.json(result);
}
