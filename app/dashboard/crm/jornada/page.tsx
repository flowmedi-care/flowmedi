import { redirect } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { JourneyListClient } from "@/components/crm/journey-list-client";
import { getJourneyList } from "./actions";
import { JOURNEY_PHASE_LABELS } from "@/lib/contact-journey";
import type { JourneyPhase, JourneySource } from "@/lib/contact-journey";

type Props = {
  searchParams: Promise<{
    phase?: JourneyPhase;
    source?: JourneySource;
    acao?: string;
    email?: string;
  }>;
};

export default async function JornadaListPage({ searchParams }: Props) {
  const params = await searchParams;
  const withPendingAction = params.acao === "pendente";

  const { data, error } = await getJourneyList({
    phase: params.phase,
    source: params.source,
    withPendingAction,
  });

  if (error === "Não autorizado.") redirect("/entrar");

  const journeys = (data ?? []).filter((j) => {
    if (!params.email) return true;
    return j.email?.toLowerCase().trim() === params.email.toLowerCase().trim();
  });

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "CRM", href: "/dashboard/crm/pipeline" }, { label: "Jornada" }],
        title: "Jornada do Contato",
        description:
          "Acompanhe o passo a passo de cada contato — da captação até o pós-consulta — com a próxima ação sugerida.",
      }}
    >
      {error && (
        <p className="text-sm text-destructive mb-4">{error}</p>
      )}

      <div className="flex flex-wrap gap-2 mb-6 text-sm">
        <FilterLink href="/dashboard/crm/jornada" active={!params.phase && !params.source && !withPendingAction}>
          Todos
        </FilterLink>
        {(Object.keys(JOURNEY_PHASE_LABELS) as JourneyPhase[]).map((phase) => (
          <FilterLink
            key={phase}
            href={`/dashboard/crm/jornada?phase=${phase}`}
            active={params.phase === phase}
          >
            {JOURNEY_PHASE_LABELS[phase]}
          </FilterLink>
        ))}
        <FilterLink
          href="/dashboard/crm/jornada?acao=pendente"
          active={withPendingAction}
        >
          Com ação pendente
        </FilterLink>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {journeys.length} jornada(s) ativa(s)
      </p>

      <JourneyListClient journeys={journeys} />
    </PageShell>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={
        active
          ? "rounded-full bg-primary px-3 py-1 text-primary-foreground font-medium"
          : "rounded-full border border-border px-3 py-1 text-muted-foreground hover:bg-muted"
      }
    >
      {children}
    </a>
  );
}
