import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { OpsBoardClient } from "@/components/hoje/hoje-dashboard-client";
import { getOperationalDashboard } from "@/app/dashboard/hoje/actions";
import type { OpsBoardStage } from "@/lib/operational-journey";

const COLUMNS: OpsBoardStage[] = ["pos_consulta", "tratamento", "retorno", "reativacao"];

export default async function PacientesOpsBoardPage() {
  const { data, error } = await getOperationalDashboard();
  if (error === "Não autorizado.") redirect("/entrar");
  if (error === "Sem permissão.") redirect("/dashboard");

  const items = (data?.items ?? []).filter(
    (i) =>
      i.panoramaSlice === "pacientes" ||
      COLUMNS.includes(i.boardStage as OpsBoardStage)
  );

  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "Hoje", href: "/dashboard/hoje" },
          { label: "Pacientes" },
        ],
        title: "Pacientes",
        description: "Pós-consulta, tratamentos, retornos e reativações.",
        backHref: "/dashboard/hoje",
      }}
    >
      <div className="p-4 sm:p-6">
        <OpsBoardClient
          title="Pacientes"
          description="Jornadas após a consulta — um Case por card."
          columns={COLUMNS}
          items={items}
        />
      </div>
    </PageShell>
  );
}
