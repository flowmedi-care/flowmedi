import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClinicDpaStatus } from "@/lib/compliance/dpa-actions";
import { getDpaDocumentUrl } from "@/lib/compliance/dpa";
import { isMfaEnrolled, type MfaFactorsList } from "@/lib/compliance/mfa-helpers";
import { DpaAcceptCard } from "@/app/dashboard/privacidade/dpa-accept-card";
import { listDataSubjectRequests } from "@/app/dashboard/privacidade/dsar-actions";
import { DsarClient } from "@/app/dashboard/privacidade/solicitacoes/dsar-client";
import { MfaSetupClient } from "../seguranca/mfa-setup-client";
import { EmailVerificationCard } from "@/components/compliance/email-verification-card";
import { Suspense } from "react";

export default async function ConfiguracoesPrivacidadePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || !["admin", "secretaria"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const isAdmin = profile.role === "admin";
  const emailVerified = Boolean(user.email_confirmed_at);
  const userEmail = user.email ?? "";

  const [dpaStatus, dsarRes, factors] = await Promise.all([
    isAdmin ? getClinicDpaStatus() : Promise.resolve(null),
    listDataSubjectRequests(),
    supabase.auth.mfa.listFactors(),
  ]);

  const hasVerifiedTotp = isMfaEnrolled(factors.data as MfaFactorsList);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Privacidade e segurança</h1>
        <p className="text-sm text-muted-foreground">
          LGPD, autenticação da conta e solicitações de titulares.
        </p>
      </div>

      {isAdmin && (
        <>
          <EmailVerificationCard email={userEmail} verified={emailVerified} />

          <div id="mfa">
            <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
              <MfaSetupClient initialEnrolled={hasVerifiedTotp} />
            </Suspense>
          </div>

          {dpaStatus && (
            <DpaAcceptCard
              accepted={dpaStatus.accepted}
              acceptedAt={dpaStatus.acceptedAt}
              currentVersion={dpaStatus.currentVersion}
              signedVersion={dpaStatus.version}
            />
          )}
        </>
      )}

      <div id="solicitacoes" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Solicitações de titulares (DSAR)</h2>
          <p className="text-sm text-muted-foreground">
            Registre e acompanhe pedidos de acesso, correção, exclusão e portabilidade (LGPD art.
            18).
          </p>
          {isAdmin && (
            <p className="text-xs text-muted-foreground mt-1">
              Portal público para pacientes:{" "}
              <Link
                href="/privacidade-titular"
                className="text-primary underline-offset-2 hover:underline"
                target="_blank"
              >
                /privacidade-titular
              </Link>
            </p>
          )}
        </div>
        <DsarClient
          initialRequests={(dsarRes.data ?? []) as Parameters<typeof DsarClient>[0]["initialRequests"]}
          isAdmin={isAdmin}
        />
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentação de compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>
                <Link
                  href={getDpaDocumentUrl()}
                  className="text-primary underline-offset-2 hover:underline"
                  target="_blank"
                >
                  Acordo de Tratamento de Dados (DPA)
                </Link>
              </li>
              <li>
                <Link
                  href="/politica-de-privacidade"
                  className="text-primary underline-offset-2 hover:underline"
                  target="_blank"
                >
                  Política de Privacidade FlowMed
                </Link>
              </li>
              <li>
                <Link
                  href="/subprocessadores"
                  className="text-primary underline-offset-2 hover:underline"
                  target="_blank"
                >
                  Subprocessadores
                </Link>
              </li>
              <li>
                <span className="text-foreground">ROPA / RIPD:</span> documentos internos em{" "}
                <code className="text-xs bg-muted px-1 rounded">docs/compliance/</code> — solicite ao
                suporte FlowMed se necessário.
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
