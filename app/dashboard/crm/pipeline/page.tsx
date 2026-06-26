import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PipelineClient } from "../../pipeline/pipeline-client";
import { getPipeline, syncNonRegisteredToPipeline } from "../../pipeline/actions";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { AppointmentPipelineClient } from "../appointment-pipeline-client";
import { CrmFunnelCharts } from "../crm-funnel-charts";
import {
  getAppointmentPipeline,
  getLeadFunnelMetrics,
  getAppointmentFunnelMetrics,
} from "../pipeline-actions";

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

  await syncNonRegisteredToPipeline();

  const [pipelineRes, appointmentRes, leadMetricsRes, appointmentMetricsRes] =
    await Promise.all([
      getPipeline(),
      getAppointmentPipeline(),
      getLeadFunnelMetrics(30, "day"),
      getAppointmentFunnelMetrics(30, "day"),
    ]);

  const leadMetrics = leadMetricsRes.data ?? {
    snapshot: { novo_contato: 0, aguardando_retorno: 0, cadastrado: 0, agendado: 0 },
    total: 0,
    taxaCadastro: 0,
    taxaAgendamento: 0,
    timeSeries: [],
    cumulativeFunnel: [],
    cohortSize: 0,
    periodDays: 30,
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
    periodDays: 30,
  };

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Pipeline CRM" }],
        title: "Pipeline CRM",
        description:
          "Captação de leads, comparecimento de consultas e funis no tempo.",
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

        <section id="captacao" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Captação</h2>
            <p className="text-sm text-muted-foreground">
              Do primeiro contato até o agendamento.
            </p>
          </div>
          {pipelineRes.error ? (
            <p className="text-sm text-destructive">{pipelineRes.error}</p>
          ) : (
            <PipelineClient initialItems={pipelineRes.data ?? []} />
          )}
        </section>

        <section id="comparecimento" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Comparecimento</h2>
            <p className="text-sm text-muted-foreground">
              Da consulta agendada até realização, falta ou cancelamento.
            </p>
          </div>
          {appointmentRes.error ? (
            <p className="text-sm text-destructive">{appointmentRes.error}</p>
          ) : (
            <AppointmentPipelineClient initialItems={appointmentRes.data ?? []} />
          )}
        </section>
      </div>
    </PageShell>
  );
}
