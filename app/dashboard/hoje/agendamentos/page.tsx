import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { OpsBoardClient } from "@/components/hoje/hoje-dashboard-client";
import { getOperationalDashboard } from "@/app/dashboard/hoje/actions";
import type { OpsBoardStage } from "@/lib/operational-journey";

const COLUMNS: OpsBoardStage[] = ["agendar", "reagendar"];

export default async function AgendamentosBoardPage() {
  const { data, error } = await getOperationalDashboard();
  if (error === "Não autorizado.") redirect("/entrar");
  if (error === "Sem permissão.") redirect("/dashboard");

  const items = (data?.items ?? []).filter(
    (i) => i.boardStage === "agendar" || i.boardStage === "reagendar"
  );

  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "Hoje", href: "/dashboard/hoje" },
          { label: "Agendamentos" },
        ],
        title: "Agendamentos",
        description: "Marcar e remarcar consultas.",
        backHref: "/dashboard/hoje",
      }}
    >
      <div className="p-4 sm:p-6">
        <OpsBoardClient
          title="Agendamentos"
          description="Agendar e reagendar — confirmar fica em Consultas."
          columns={COLUMNS}
          items={items}
        />
      </div>
    </PageShell>
  );
}
