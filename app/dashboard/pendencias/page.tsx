import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { PendenciasClient } from "@/components/hoje/hoje-dashboard-client";
import { getOperationalDashboard } from "@/app/dashboard/hoje/actions";

type Props = {
  searchParams: Promise<{ action?: string; filter?: string }>;
};

export default async function PendenciasPage({ searchParams }: Props) {
  const params = await searchParams;
  const { data, error } = await getOperationalDashboard();
  if (error === "Não autorizado.") redirect("/entrar");
  if (error === "Sem permissão.") redirect("/dashboard");

  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "Hoje", href: "/dashboard/hoje" },
          { label: "Pendências" },
        ],
        title: "Pendências",
        description: "Tudo que alguém precisa fazer agora.",
        backHref: "/dashboard/hoje",
      }}
    >
      {error && !data && <p className="text-sm text-destructive p-4">{error}</p>}
      {data && (
        <div className="p-4 sm:p-6">
          <PendenciasClient
            items={data.pendencias}
            actionFilter={params.action ?? null}
            filter={params.filter ?? null}
          />
        </div>
      )}
    </PageShell>
  );
}
