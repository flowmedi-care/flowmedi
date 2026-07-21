import Link from "next/link";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthenticationDecision } from "@/lib/compliance/mfa-enforcement";
import { MFA_WIZARD_PATH } from "@/lib/compliance/mfa-helpers";

/** Soft reminder from AuthenticationDecision.showReminderBanner. */
export async function MfaReminderBanner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const decision = await resolveAuthenticationDecision(supabase, profile?.role);
  if (!decision.showReminderBanner) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-2">
        <Shield className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-foreground">
          Recomendamos autenticação em dois fatores (MFA) para proteger o acesso aos dados da
          clínica.
        </p>
      </div>
      <Link
        href={MFA_WIZARD_PATH}
        className="text-sm font-medium text-primary underline-offset-2 hover:underline shrink-0"
      >
        Configurar MFA
      </Link>
    </div>
  );
}
