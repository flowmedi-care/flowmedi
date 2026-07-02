import { Shield, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isMfaEnrolled, type MfaFactorsList } from "@/lib/compliance/mfa-helpers";
import { requiresMfaForRole } from "@/lib/compliance/mfa-enforcement";
import { MfaWizard } from "@/components/compliance/mfa-wizard";

export default async function OnboardingMfaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user.id)
    .single();

  if (!requiresMfaForRole(profile?.role)) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center text-sm text-muted-foreground">
        MFA não é obrigatório para o seu perfil.{" "}
        <a href="/dashboard" className="text-primary underline-offset-2 hover:underline">
          Ir ao painel
        </a>
      </div>
    );
  }

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
          Administradores e profissionais precisam de autenticação em dois fatores para acessar
          dados de saúde.
        </p>
      </div>
      <MfaWizard mode="onboarding" />
    </div>
  );
}
