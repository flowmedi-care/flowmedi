import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { CaseBoardClient } from "@/components/crm/case-board-client";
import { getCaseBoard } from "./case-actions";
import type { BoardView } from "./case-types";

type Props = {
  searchParams: Promise<{ view?: string }>;
};

const VALID_VIEWS: BoardView[] = [
  "pipeline",
  "comparecimento",
  "financeiro",
  "ia",
  "pendencias",
];

export default async function JornadaBoardPage({ searchParams }: Props) {
  const params = await searchParams;
  const view = (VALID_VIEWS.includes(params.view as BoardView)
    ? params.view
    : "pipeline") as BoardView;

  const { data, error } = await getCaseBoard(view);
  if (error === "Não autorizado.") redirect("/entrar");

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "CRM", href: "/dashboard/crm/pipeline" }, { label: "Jornada" }],
        title: "Jornada",
        description:
          "Lista de entrada dos Cases. Clique para abrir o Workspace — posto de trabalho do processo.",
      }}
    >
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {data && <CaseBoardClient initial={data} initialView={view} />}
    </PageShell>
  );
}
