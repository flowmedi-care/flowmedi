import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isMfaEnrolled, type MfaFactorsList } from "@/lib/compliance/mfa-helpers";
import { MfaSetupClient } from "./mfa-setup-client";

export default async function SegurancaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = isMfaEnrolled(factors as MfaFactorsList);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Segurança da conta</h1>
        <p className="text-sm text-muted-foreground">
          Autenticação em dois fatores e boas práticas de acesso (LGPD art. 46).
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
        <MfaSetupClient initialEnrolled={hasVerifiedTotp} />
      </Suspense>
    </div>
  );
}
