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
          { label: "Hoje", href: "/dashboard/hoje" },
          { label: "Pendências", href: "/dashboard/pendencias" },
          { label: "Workspace" },
        ],
        title: "Case não encontrado",
      }}
      >
        <p className="text-sm text-destructive">{error ?? "Case inválido."}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/dashboard/pendencias">Voltar</Link>
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "Hoje", href: "/dashboard/hoje" },
          { label: "Pendências", href: "/dashboard/pendencias" },
          { label: data.header.displayName },
        ],
        title: "Workspace",
        description: "Tudo para operar este Case.",
      }}
      toolbar={
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/pendencias">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Pendências
          </Link>
        </Button>
      }
    >
      <CaseWorkspaceClient data={data} />
    </PageShell>
  );
}
