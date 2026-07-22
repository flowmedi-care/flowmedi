import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { CaseBoardClient } from "@/components/crm/case-board-client";
import { findCaseIdByEmail, findCaseIdByPhone, getCaseBoard } from "./case-actions";
import type { BoardView } from "./case-types";

type Props = {
  searchParams: Promise<{
    view?: string;
    workflow?: string;
    phone?: string;
    email?: string;
    caseId?: string;
  }>;
};

const VALID: BoardView[] = ["pendencias", "fluxo", "comparecimento", "ia"];

export default async function JornadaBoardPage({ searchParams }: Props) {
  const params = await searchParams;

  if (params.caseId) {
    redirect(`/dashboard/crm/jornada/${params.caseId}`);
  }
  if (params.phone) {
    const { caseId } = await findCaseIdByPhone(params.phone);
    if (caseId) redirect(`/dashboard/crm/jornada/${caseId}`);
  }
  if (params.email) {
    const { caseId } = await findCaseIdByEmail(params.email);
    if (caseId) redirect(`/dashboard/crm/jornada/${caseId}`);
  }

  // v6: views antigas → novos modos
  if (!params.view || params.view === "pendencias") {
    redirect("/dashboard/pendencias");
  }
  if (params.view === "comparecimento") {
    redirect("/dashboard/hoje/consultas");
  }
  if (params.view === "ia") {
    redirect("/dashboard/pendencias?filter=ai");
  }
  // fluxo permanece legado para admin com seletor de workflow

  const view = (VALID.includes(params.view as BoardView)
    ? params.view
    : "fluxo") as BoardView;

  const { data, error } = await getCaseBoard(view, params.workflow ?? null);
  if (error === "Não autorizado.") redirect("/entrar");

  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "Hoje", href: "/dashboard/hoje" },
          { label: "Jornada (legado)" },
        ],
        title: "Fluxo por tipo de jornada",
        description:
          "Board legado por fases do workflow. Preferira Hoje, Pendências e os boards de Agenda.",
      }}
    >
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      {data && <CaseBoardClient initial={data} initialView={view} />}
    </PageShell>
  );
}
