"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FlowmediAgentBento } from "@/components/agents/flowmedi-agent-bento";
import { AgentActivityFeed } from "@/components/agents/agent-activity-feed";
import { JourneyCommandCanvas } from "@/components/agents/journey-command-canvas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ContactJourney } from "@/lib/contact-journey";
import { JOURNEY_PHASE_LABELS } from "@/lib/contact-journey";
import { ArrowRight, ExternalLink } from "lucide-react";

type Props = {
  initialPending: ContactJourney[];
};

export function JornadaCentroClient({ initialPending }: Props) {
  const [pending, setPending] = useState(initialPending);
  const [highlightStep, setHighlightStep] = useState<string | null>(null);
  const [selected, setSelected] = useState<ContactJourney | null>(initialPending[0] ?? null);

  const refreshPending = useCallback(async () => {
    const res = await fetch("/api/agents/dashboard");
    if (!res.ok) return;
    const data = await res.json();
    setHighlightStep(
      data.agentRuns.find((r: { status: string }) => r.status === "running")?.detail
        ?.step as string | null ?? null
    );
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  return (
    <div className="space-y-6">
      <FlowmediAgentBento />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <JourneyCommandCanvas
            currentStep={selected?.currentStep}
            completedSteps={selected?.completedSteps ?? []}
            highlightStep={highlightStep as ContactJourney["currentStep"] | null}
          />
        </div>
        <AgentActivityFeed onJourneyRunComplete={refreshPending} />
      </div>

      <div className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Contatos com ação pendente</h2>
            <p className="text-xs text-muted-foreground">
              {pending.length} contato(s) aguardando ação do Journey Agent
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm/jornada?acao=pendente">
              Ver na listagem
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="divide-y">
          {pending.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhuma ação pendente no momento. A jornada está em dia.
            </p>
          ) : (
            pending.slice(0, 15).map((j) => (
              <button
                key={j.contactKey}
                type="button"
                onClick={() => setSelected(j)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{j.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {j.suggestedAction?.label} — {j.suggestedAction?.description}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {JOURNEY_PHASE_LABELS[j.phase]}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                  <Link href={`/dashboard/crm/jornada/${encodeURIComponent(j.contactKey)}`}>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
