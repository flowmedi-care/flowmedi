import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MfaSetupClient } from "./mfa-setup-client";

export default async function SegurancaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasTotp = (factors?.totp?.length ?? 0) > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Segurança da conta</h1>
        <p className="text-sm text-muted-foreground">
          Autenticação em dois fatores e boas práticas de acesso (LGPD art. 46).
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
        <MfaSetupClient hasTotp={hasTotp} />
      </Suspense>
    </div>
  );
}
