import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getClinicDpaStatus } from "@/lib/compliance/dpa-actions";
import { getDpaDocumentUrl } from "@/lib/compliance/dpa";
import { DpaAcceptCard } from "./dpa-accept-card";

export default async function PrivacidadeHubPage() {
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

  if (!profile?.clinic_id || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const dpaStatus = await getClinicDpaStatus();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Privacidade e LGPD</h1>
        <p className="text-sm text-muted-foreground">
          Governança de dados da clínica na plataforma FlowMed.
        </p>
      </div>

      <DpaAcceptCard
        accepted={dpaStatus.accepted}
        acceptedAt={dpaStatus.acceptedAt}
        currentVersion={dpaStatus.currentVersion}
        signedVersion={dpaStatus.version}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Solicitações de titulares (DSAR)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Registre e acompanhe pedidos de acesso, correção, exclusão e portabilidade.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/privacidade/solicitacoes">Abrir solicitações</Link>
            </Button>
            <p className="text-xs">
              Portal público para pacientes:{" "}
              <Link href="/privacidade-titular" className="text-primary underline-offset-2 hover:underline" target="_blank">
                /privacidade-titular
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consentimento de marketing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Configure bloqueio de marketing sem consentimento e textos padrão.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/configuracoes/preferencias">Preferências da clínica</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segurança (MFA)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>MFA obrigatório para administradores e médicos.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/configuracoes/seguranca">Configurar MFA</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auditoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Registros de ações sensíveis no painel.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/auditoria">Ver auditoria</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentação de compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li>
              <Link href={getDpaDocumentUrl()} className="text-primary underline-offset-2 hover:underline" target="_blank">
                Acordo de Tratamento de Dados (DPA)
              </Link>
            </li>
            <li>
              <Link href="/politica-de-privacidade" className="text-primary underline-offset-2 hover:underline" target="_blank">
                Política de Privacidade FlowMed
              </Link>
            </li>
            <li>
              <Link href="/subprocessadores" className="text-primary underline-offset-2 hover:underline" target="_blank">
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
    </div>
  );
}
