import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { HojeDashboardClient } from "@/components/hoje/hoje-dashboard-client";
import { parseHojeSearchParams } from "@/lib/operational-journey";
import { getOperationalDashboard } from "./actions";

type Props = {
  searchParams: Promise<{
    area?: string;
    stage?: string;
    case?: string;
    caseId?: string;
    focus?: string;
  }>;
};

export default async function HojePage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "medico") redirect("/dashboard");

  const { data, error } = await getOperationalDashboard();
  if (error === "Não autorizado.") redirect("/entrar");

  const initialContext = parseHojeSearchParams(params);

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Hoje" }],
        title: "Hoje",
        description: "O que precisa de decisão agora — e onde trabalhar.",
      }}
    >
      {error && !data && (
        <p className="text-sm text-destructive p-4">{error}</p>
      )}
      {data && (
        <div className="p-4 sm:p-6">
          <HojeDashboardClient
            projection={data}
            firstName={profile?.full_name}
            initialContext={initialContext}
          />
        </div>
      )}
    </PageShell>
  );
}
