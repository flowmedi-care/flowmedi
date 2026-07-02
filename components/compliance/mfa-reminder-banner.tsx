import Link from "next/link";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requiresMfaForRole } from "@/lib/compliance/mfa-enforcement";
import { checkMfaEnrolled } from "@/lib/compliance/mfa-service";
import { MFA_WIZARD_PATH } from "@/lib/compliance/mfa-helpers";

/** Lembrete para habilitar MFA (LGPD art. 46 — segurança). */
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

  const mandatory = requiresMfaForRole(profile?.role);
  const enrolled = await checkMfaEnrolled(supabase);
  if (enrolled) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-2">
        <Shield className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-foreground">
          {mandatory
            ? "Configure a autenticação em dois fatores (MFA) para acessar o painel com dados de saúde."
            : "Proteja o acesso à plataforma com autenticação em dois fatores (MFA)."}
        </p>
      </div>
      <Link
        href={mandatory ? MFA_WIZARD_PATH : "/dashboard/configuracoes/seguranca"}
        className="text-sm font-medium text-primary underline-offset-2 hover:underline shrink-0"
      >
        {mandatory ? "Configurar agora" : "Configurar MFA"}
      </Link>
    </div>
  );
}
