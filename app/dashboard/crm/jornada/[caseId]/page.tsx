import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { Button } from "@/components/ui/button";
import { CaseWorkspaceClient } from "@/components/crm/case-workspace-client";
import { getCaseWorkspace } from "../case-actions";
import { buildHojeHref, normalizeHojeArea } from "@/lib/operational-journey";
import { ArrowLeft } from "lucide-react";

type Props = {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ from?: string; area?: string }>;
};

export default async function CaseWorkspacePage({ params, searchParams }: Props) {
  const { caseId } = await params;
  const sp = await searchParams;

  if (caseId.startsWith("lead-") || caseId.startsWith("patient-")) {
    redirect("/dashboard/hoje");
  }

  const backHref = buildHojeHref({
    area: normalizeHojeArea(sp.area) ?? undefined,
    caseId: sp.from === "hoje" ? caseId : null,
  });

  const { data, error } = await getCaseWorkspace(caseId);
  if (error === "Não autorizado.") redirect("/entrar");
  if (error || !data) {
    return (
      <PageShell
        header={{
          breadcrumbs: [
            { label: "Hoje", href: "/dashboard/hoje" },
            { label: "Workspace" },
          ],
          title: "Case não encontrado",
        }}
      >
        <p className="text-sm text-destructive">{error ?? "Case inválido."}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href={backHref}>Voltar</Link>
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "Hoje", href: "/dashboard/hoje" },
          { label: data.header.displayName },
        ],
        title: data.header.displayName,
        description: "Quem conduz · quem decide · por quê",
      }}
      toolbar={
        <Button variant="outline" size="sm" asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Voltar ao Hoje
          </Link>
        </Button>
      }
    >
      <CaseWorkspaceClient data={data} />
    </PageShell>
  );
}
