import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { Button } from "@/components/ui/button";
import { CaseWorkspaceClient } from "@/components/crm/case-workspace-client";
import { getCaseWorkspace } from "../case-actions";
import { ArrowLeft } from "lucide-react";

type Props = {
  params: Promise<{ caseId: string }>;
};

export default async function CaseWorkspacePage({ params }: Props) {
  const { caseId } = await params;

  // Legacy contact keys lead-xxx / patient-xxx → board (cases use UUIDs)
  if (caseId.startsWith("lead-") || caseId.startsWith("patient-")) {
    redirect("/dashboard/crm/jornada");
  }

  const { data, error } = await getCaseWorkspace(caseId);
  if (error === "Não autorizado.") redirect("/entrar");
  if (error || !data) {
    return (
      <PageShell
        header={{
          breadcrumbs: [
            { label: "CRM", href: "/dashboard/crm/pipeline" },
            { label: "Jornada", href: "/dashboard/crm/jornada" },
            { label: "Workspace" },
          ],
          title: "Case não encontrado",
        }}
      >
        <p className="text-sm text-destructive">{error ?? "Case inválido."}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/dashboard/crm/jornada">Voltar à Jornada</Link>
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "CRM", href: "/dashboard/crm/pipeline" },
          { label: "Jornada", href: "/dashboard/crm/jornada" },
          { label: data.displayName },
        ],
        title: "Workspace",
        description: "Posto de trabalho do Case — módulos como painéis do mesmo contexto.",
      }}
      toolbar={
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/crm/jornada">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Lista
          </Link>
        </Button>
      }
    >
      <CaseWorkspaceClient data={data} />
    </PageShell>
  );
}
