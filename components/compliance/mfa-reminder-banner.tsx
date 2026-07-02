import Link from "next/link";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requiresMfaForRole } from "@/lib/compliance/mfa-enforcement";

/** Lembrete / obrigatoriedade MFA (LGPD art. 46). */
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

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasTotp = (factors?.totp?.length ?? 0) > 0;
  if (hasTotp) return null;

  const mandatory = requiresMfaForRole(profile?.role);

  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-2">
        <Shield className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-foreground">
          {mandatory
            ? "MFA é obrigatório para administradores e médicos. Configure antes de usar o painel."
            : "Proteja o acesso à plataforma com autenticação em dois fatores (MFA)."}
        </p>
      </div>
      <Link
        href="/dashboard/configuracoes/seguranca"
        className="text-sm font-medium text-primary underline-offset-2 hover:underline shrink-0"
      >
        Configurar MFA
      </Link>
    </div>
  );
}
