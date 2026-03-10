import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminReportsClient } from "./reports/admin-reports-client";
import {
  getVisaoGeralData,
  getPorProfissionalData,
  getPorAtendenteData,
  getFinanceiroData,
  getOperacionalData,
  type Period,
} from "./reports/actions";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canAccessReportTab } from "@/lib/plan-gates";

export type ReportTab = "visao-geral" | "profissional" | "atendente" | "financeiro" | "operacional";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; period?: string; [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/dashboard");
  const clinicId = profile.clinic_id;

  const params = await searchParams;
  const tabRaw = params.tab;
  const periodRaw = params.period;
  const tab = (Array.isArray(tabRaw) ? tabRaw[0] : tabRaw) ?? "visao-geral";
  const period = (Array.isArray(periodRaw) ? periodRaw[0] : periodRaw) ?? "30d";
  const validTabs: ReportTab[] = ["visao-geral", "profissional", "atendente", "financeiro", "operacional"];
  const planData = await getClinicPlanData();
  const allowedTabs = validTabs.filter((t) =>
    canAccessReportTab(
      planData?.limits ?? {
        max_doctors: null,
        max_secretaries: null,
        max_appointments_per_month: null,
        max_patients: null,
        max_form_templates: null,
        max_custom_fields: null,
        storage_mb: null,
        whatsapp_enabled: true,
        email_enabled: true,
        custom_logo_enabled: true,
        priority_support: true,
        reports_basic_enabled: true,
        reports_advanced_enabled: true,
        reports_managerial_enabled: true,
        productivity_team_enabled: true,
        operational_indicators_enabled: true,
        audit_log_enabled: true,
      },
      t
    )
  );
  const fallbackTab = (allowedTabs[0] ?? "visao-geral") as ReportTab;
  const requestedTab = validTabs.includes(tab as ReportTab) ? (tab as ReportTab) : fallbackTab;
  const activeTab: ReportTab = allowedTabs.includes(requestedTab) ? requestedTab : fallbackTab;
  const periodTyped: Period = period === "7d" || period === "90d" ? period : "30d";

  let visaoGeral = null;
  let porProfissional = null;
  let porAtendente = null;
  let financeiro = null;
  let operacional = null;

  if (activeTab === "visao-geral") {
    const res = await getVisaoGeralData(clinicId, periodTyped);
    visaoGeral = res.data;
  } else if (activeTab === "profissional") {
    const res = await getPorProfissionalData(clinicId, periodTyped);
    porProfissional = res.data;
  } else if (activeTab === "atendente") {
    const res = await getPorAtendenteData(clinicId, periodTyped);
    porAtendente = res.data;
  } else if (activeTab === "financeiro") {
    const res = await getFinanceiroData(clinicId, periodTyped);
    financeiro = res.data;
  } else if (activeTab === "operacional") {
    const res = await getOperacionalData(clinicId, periodTyped);
    operacional = res.data;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Métricas e indicadores da clínica</p>
        </div>
        <Link
          href="/dashboard/auditoria"
          className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          🛡 Auditoria
        </Link>
      </div>

      <AdminReportsClient
        activeTab={activeTab}
        allowedTabs={allowedTabs as ReportTab[]}
        period={periodTyped}
        visaoGeral={visaoGeral}
        porProfissional={porProfissional ?? []}
        porAtendente={porAtendente ?? []}
        financeiro={financeiro}
        operacional={operacional}
      />
    </div>
  );
}
