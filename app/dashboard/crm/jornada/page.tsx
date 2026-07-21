import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { CaseBoardClient } from "@/components/crm/case-board-client";
import { getCaseBoard } from "./case-actions";
import type { BoardView } from "./case-types";

type Props = {
  searchParams: Promise<{ view?: string; workflow?: string }>;
};

const VALID: BoardView[] = ["pendencias", "fluxo", "comparecimento", "ia"];

export default async function JornadaBoardPage({ searchParams }: Props) {
  const params = await searchParams;
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
          "Ops de atendimento — Pendências, Fluxo por workflow, Comparecimento e Atendimento automático.",
      }}
    >
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      {data && <CaseBoardClient initial={data} initialView={view} />}
    </PageShell>
  );
}
