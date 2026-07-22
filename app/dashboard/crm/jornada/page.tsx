import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { CaseBoardClient } from "@/components/crm/case-board-client";
import { findCaseIdByPhone, getCaseBoard } from "./case-actions";
import type { BoardView } from "./case-types";

type Props = {
  searchParams: Promise<{
    view?: string;
    workflow?: string;
    phone?: string;
    caseId?: string;
  }>;
};

const VALID: BoardView[] = ["pendencias", "fluxo", "comparecimento", "ia"];

export default async function JornadaBoardPage({ searchParams }: Props) {
  const params = await searchParams;

  // Princípio Zero: deep-link leva direto ao Workspace
  if (params.caseId) {
    redirect(`/dashboard/crm/jornada/${params.caseId}`);
  }
  if (params.phone) {
    const { caseId } = await findCaseIdByPhone(params.phone);
    if (caseId) redirect(`/dashboard/crm/jornada/${caseId}`);
  }

  const view = (VALID.includes(params.view as BoardView)
    ? params.view
    : "pendencias") as BoardView;

  const { data, error } = await getCaseBoard(view, params.workflow ?? null);
  if (error === "Não autorizado.") redirect("/entrar");

  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "CRM", href: "/dashboard/crm/pipeline" },
          { label: "Jornada" },
        ],
        title: "Jornada",
        description:
          "Pendências (decisões), Fluxo, Comparecimento e Atendimento automático.",
      }}
    >
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      {params.phone && !error && (
        <p className="mb-4 text-sm text-muted-foreground">
          Nenhum atendimento vinculado a este telefone. Veja as pendências abaixo.
        </p>
      )}
      {data && <CaseBoardClient initial={data} initialView={view} />}
    </PageShell>
  );
}
