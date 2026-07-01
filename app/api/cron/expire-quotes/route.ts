import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * Marca orçamentos enviados como expirados quando valid_until passou.
 * GET /api/cron/expire-quotes?secret=...
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const supabase = createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("quotes")
    .update({ status: "expirado", updated_at: new Date().toISOString() })
    .eq("status", "enviado")
    .lt("valid_until", today)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expired: data?.length ?? 0 });
}
