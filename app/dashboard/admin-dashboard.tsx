import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getVisaoGeralData, getVisaoGeralWeekData, type Period } from "./visao-geral/actions";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { getOrSetMemoryCache } from "@/lib/server-memory-cache";
import { AdminTodayStrip } from "./admin-today-strip";
import { FinanceAlertsPanelServer } from "./financeiro/finance-alerts-panel-server";
import { VisaoGeralClient } from "./visao-geral/visao-geral-client";
import { getStartOfWeek } from "./agenda/agenda-date-utils";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/dashboard");
  const clinicId = profile.clinic_id;

  const params = await searchParams;
  const periodRaw = params.period;
  const period = (Array.isArray(periodRaw) ? periodRaw[0] : periodRaw) ?? "30d";
  const periodTyped: Period = period === "7d" || period === "90d" ? period : "30d";

  const planData = await getClinicPlanData();
  const weekStart = getStartOfWeek(new Date());

  const [visaoGeral, weekData] = await Promise.all([
    getOrSetMemoryCache(
      `visao-geral:${clinicId}:${periodTyped}`,
      120000,
      async () => (await getVisaoGeralData(clinicId, periodTyped)).data
    ),
    getOrSetMemoryCache(
      `visao-geral:${clinicId}:week:${weekStart.toISOString().slice(0, 10)}`,
      120000,
      async () => (await getVisaoGeralWeekData(weekStart.toISOString())).data
    ),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Visão Geral</h1>
          <p className="text-sm text-muted-foreground">Indicadores e operação da clínica</p>
        </div>
        {planData && planData.limits.audit_log_enabled && (
          <Link
            href="/dashboard/auditoria"
            className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Auditoria
          </Link>
        )}
      </div>

      <AdminTodayStrip clinicId={clinicId} />

      <FinanceAlertsPanelServer />

      <VisaoGeralClient period={periodTyped} visaoGeral={visaoGeral} weekData={weekData} />
    </div>
  );
}
