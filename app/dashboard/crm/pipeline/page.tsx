import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { CrmFunnelCharts } from "../crm-funnel-charts";
import { CrmPipelineBoardsClient } from "../crm-pipeline-boards-client";
import {
  getAppointmentPipeline,
  getLeadFunnelMetrics,
  getAppointmentFunnelMetrics,
} from "../pipeline-actions";
import { getPresetFunnelPeriod } from "@/lib/analytics/time-buckets";
import { createClient } from "@/lib/supabase/server";

export default async function CrmPipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "secretaria")) {
    redirect("/dashboard");
  }

  const defaultPeriod = getPresetFunnelPeriod("30d");

  const [appointmentRes, leadMetricsRes, appointmentMetricsRes] = await Promise.all([
    getAppointmentPipeline(),
    getLeadFunnelMetrics(defaultPeriod),
    getAppointmentFunnelMetrics(defaultPeriod),
  ]);

  const leadMetrics = leadMetricsRes.data ?? {
    snapshot: {
      lead_novo: 0,
      em_qualificacao: 0,
      qualificado: 0,
      oportunidade: 0,
      cliente: 0,
      perdido: 0,
    },
    total: 0,
    taxaCadastro: 0,
    taxaAgendamento: 0,
    timeSeries: [],
    cumulativeFunnel: [],
    cohortSize: 0,
    period: defaultPeriod,
  };

  const appointmentMetrics = appointmentMetricsRes.data ?? {
    snapshot: {
      agendadas: 0,
      confirmadas: 0,
      realizadas: 0,
      faltas: 0,
      canceladas: 0,
    },
    total: 0,
    taxaConfirmacao: 0,
    taxaComparecimento: 0,
    taxaNoShow: 0,
    timeSeries: [],
    cumulativeFunnel: [],
    outcomeBranches: [],
    period: defaultPeriod,
  };

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Pipeline CRM" }],
        title: "Pipeline CRM",
        description:
          "Comparecimento de consultas e funis no tempo. Captação em Contatos → Leads.",
      }}
      elevated={false}
    >
      <div className="space-y-10">
        {(leadMetricsRes.error || appointmentMetricsRes.error) && (
          <p className="text-sm text-destructive">
            {leadMetricsRes.error || appointmentMetricsRes.error}
          </p>
        )}

        <CrmFunnelCharts
          initialLeadMetrics={leadMetrics}
          initialAppointmentMetrics={appointmentMetrics}
        />

        {(appointmentRes.error) && (
          <p className="text-sm text-destructive">{appointmentRes.error}</p>
        )}

        <CrmPipelineBoardsClient
          appointmentItems={appointmentRes.error ? [] : (appointmentRes.data ?? [])}
        />
      </div>
    </PageShell>
  );
}
