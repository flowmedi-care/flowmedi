import { Shield, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isMfaEnrolled, type MfaFactorsList } from "@/lib/compliance/mfa-helpers";
import { MfaWizard } from "@/components/compliance/mfa-wizard";

/** Voluntary MFA onboarding — always accessible; enrollment is optional by default policy. */
export default async function OnboardingMfaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (isMfaEnrolled(factors as MfaFactorsList)) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
        <p className="text-foreground font-medium">MFA já está configurado.</p>
        <a href="/dashboard" className="text-primary text-sm underline-offset-2 hover:underline">
          Continuar para o painel
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="mb-8 text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Proteja sua conta</h1>
        <p className="text-sm text-muted-foreground">
          Recomendamos autenticação em dois fatores para proteger o acesso aos dados da clínica.
          É opcional — você pode configurar agora ou depois em Privacidade.
        </p>
      </div>
      <MfaWizard mode="onboarding" />
    </div>
  );
}
