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

export type ReportTab = "visao-geral" | "profissional" | "atendente" | "financeiro" | "operacional";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; period?: string }>;
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
  const tab = (params.tab ?? "visao-geral") as ReportTab;
  const period = (params.period ?? "30d") as Period;
  const validTabs: ReportTab[] = ["visao-geral", "profissional", "atendente", "financeiro", "operacional"];
  const activeTab = validTabs.includes(tab) ? tab : "visao-geral";

  let visaoGeral = null;
  let porProfissional = null;
  let porAtendente = null;
  let financeiro = null;
  let operacional = null;

  if (activeTab === "visao-geral") {
    const res = await getVisaoGeralData(clinicId, period);
    visaoGeral = res.data;
  } else if (activeTab === "profissional") {
    const res = await getPorProfissionalData(clinicId, period);
    porProfissional = res.data;
  } else if (activeTab === "atendente") {
    const res = await getPorAtendenteData(clinicId, period);
    porAtendente = res.data;
  } else if (activeTab === "financeiro") {
    const res = await getFinanceiroData(clinicId, period);
    financeiro = res.data;
  } else if (activeTab === "operacional") {
    const res = await getOperacionalData(clinicId, period);
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
        period={period}
        visaoGeral={visaoGeral}
        porProfissional={porProfissional ?? []}
        porAtendente={porAtendente ?? []}
        financeiro={financeiro}
        operacional={operacional}
      />
    </div>
  );
}
