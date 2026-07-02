import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { Button } from "@/components/ui/button";
import { getJourneyList } from "../actions";
import { JornadaCentroClient } from "./jornada-centro-client";
import { Sparkles } from "lucide-react";

export default async function JornadaCentroPage() {
  const { data, error } = await getJourneyList({ withPendingAction: true });

  if (error === "Não autorizado.") redirect("/entrar");

  const pending = data ?? [];

  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "CRM", href: "/dashboard/crm/pipeline" },
          { label: "Jornada", href: "/dashboard/crm/jornada" },
          { label: "Centro de Jornada" },
        ],
        title: "Centro de Jornada",
        description:
          "Painel imersivo dos agentes operacionais — fluxo visual, activity feed e execução de ações CRM.",
        actions: (
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm/jornada">
              <Sparkles className="mr-1.5 h-4 w-4" />
              Listagem clássica
            </Link>
          </Button>
        ),
      }}
    >
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      <JornadaCentroClient initialPending={pending} />
    </PageShell>
  );
}
