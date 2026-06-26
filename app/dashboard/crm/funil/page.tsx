import { getConsultationFunnel } from "../actions";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { StatCard } from "@/components/dashboard-ui/stat-card";
import { Calendar, CheckCircle, XCircle, Ban } from "lucide-react";

export default async function CrmFunilPage() {
  const { data, error } = await getConsultationFunnel(30);

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Funil de consultas" }],
        title: "Funil de consultas",
        description:
          "Métricas operacionais de agendamento nos últimos 30 dias (diferente do pipeline de leads).",
      }}
      elevated={false}
    >
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Agendadas" value={data.agendadas} icon={Calendar} />
          <StatCard
            title="Confirmadas"
            value={data.confirmadas}
            subtitle={`${data.taxaConfirmacao}% confirmação`}
            icon={CheckCircle}
            iconColor="success"
          />
          <StatCard
            title="Realizadas"
            value={data.compareceram}
            subtitle={`${data.taxaComparecimento}% comparecimento`}
            icon={CheckCircle}
            iconColor="info"
          />
          <StatCard title="Faltas (no-show)" value={data.noShow} icon={Ban} iconColor="warning" />
          <StatCard title="Canceladas" value={data.canceladas} icon={XCircle} iconColor="destructive" />
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Para análises detalhadas por profissional, use a aba Relatórios no Início (admin).
      </p>
    </PageShell>
  );
}
