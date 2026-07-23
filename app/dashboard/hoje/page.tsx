import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HojeDashboardClient } from "@/components/hoje/hoje-dashboard-client";
import { parseHojeSearchParams } from "@/lib/operational-journey";
import { getLeadsHubData } from "@/app/dashboard/contatos/leads/actions";
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

  const [{ data, error }, leads] = await Promise.all([
    getOperationalDashboard(),
    getLeadsHubData(),
  ]);
  if (error === "Não autorizado.") redirect("/entrar");

  const initialContext = parseHojeSearchParams(params);
  const contatosPipeline = leads.data?.pipeline ?? [];

  return (
    <div className="min-w-0 px-4 pb-10 pt-2 sm:px-6 sm:pb-12 sm:pt-4">
      {error && !data && (
        <p className="text-sm text-destructive py-6">{error}</p>
      )}
      {data && (
        <HojeDashboardClient
          projection={data}
          firstName={profile?.full_name}
          initialContext={initialContext}
          contatosPipeline={contatosPipeline}
        />
      )}
    </div>
  );
}
