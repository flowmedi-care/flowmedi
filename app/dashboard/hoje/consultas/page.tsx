import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { OpsBoardClient } from "@/components/hoje/hoje-dashboard-client";
import { getOperationalDashboard } from "@/app/dashboard/hoje/actions";
import type { OpsBoardStage } from "@/lib/operational-journey";

const COLUMNS: OpsBoardStage[] = [
  "confirmar",
  "hoje",
  "em_atendimento",
  "realizada",
  "falta",
];

type Props = { searchParams: Promise<{ stage?: string }> };

export default async function ConsultasBoardPage({ searchParams }: Props) {
  await searchParams;
  const { data, error } = await getOperationalDashboard();
  if (error === "Não autorizado.") redirect("/entrar");
  if (error === "Sem permissão.") redirect("/dashboard");

  const items = (data?.items ?? []).filter(
    (i) => i.panoramaSlice === "consultas" || COLUMNS.includes(i.boardStage as OpsBoardStage)
  );

  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "Hoje", href: "/dashboard/hoje" },
          { label: "Consultas" },
        ],
        title: "Consultas",
        description: "Confirmar, acompanhar o dia e registrar resultado.",
        backHref: "/dashboard/hoje",
      }}
    >
      <div className="p-4 sm:p-6">
        <OpsBoardClient
          title="Consultas"
          description="Preparação e dia clínico — separado de marcar horário."
          columns={COLUMNS}
          items={items}
        />
      </div>
    </PageShell>
  );
}
