"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getStepDefinition,
  JOURNEY_PHASE_LABELS,
  type ContactJourney,
  type JourneyPhase,
  type JourneySource,
  type LifecycleStageCode,
} from "@/lib/contact-journey";
import { LIFECYCLE_STAGE_LABELS } from "@/lib/leads/lifecycle";
import { ChevronRight, FileText, MessageSquare, Globe, User } from "lucide-react";

const SOURCE_LABELS: Record<JourneySource, string> = {
  form: "Formulário",
  whatsapp: "WhatsApp",
  site: "Site",
  manual: "Manual",
};

function SourceBadge({ source }: { source: JourneySource }) {
  const icons = {
    form: FileText,
    whatsapp: MessageSquare,
    site: Globe,
    manual: User,
  };
  const Icon = icons[source];
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon className="h-3 w-3" />
      {SOURCE_LABELS[source]}
    </Badge>
  );
}

type JourneyListClientProps = {
  journeys: ContactJourney[];
  phaseFilter?: JourneyPhase;
  sourceFilter?: JourneySource;
  withActionOnly?: boolean;
};

export function JourneyListClient({
  journeys,
}: JourneyListClientProps) {
  if (journeys.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma jornada ativa encontrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {journeys.map((j) => {
        const step = getStepDefinition(j.currentStep);
        return (
          <Link key={j.contactKey} href={`/dashboard/crm/jornada/${j.contactKey}`}>
            <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
              <CardContent className="py-4 flex flex-wrap items-center gap-3 justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-medium truncate">{j.displayName}</p>
                    <SourceBadge source={j.source} />
                    <Badge variant="secondary" className="font-normal">
                      {JOURNEY_PHASE_LABELS[j.phase]}
                    </Badge>
                    {j.lifecycleStage && (
                      <Badge variant="outline" className="font-normal">
                        {LIFECYCLE_STAGE_LABELS[j.lifecycleStage as LifecycleStageCode]}
                      </Badge>
                    )}
                    {j.leadScore != null && j.leadScore > 0 && (
                      <Badge variant="outline" className="font-normal">
                        Score {j.leadScore}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Etapa: <span className="text-foreground">{step.label}</span>
                    {j.email && <> · {j.email}</>}
                  </p>
                  {j.suggestedAction && (
                    <p className="text-xs text-primary mt-1">
                      Próximo: {j.suggestedAction.label}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export function JourneyTimeline({ entries }: { entries: ContactJourney["timeline"] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum histórico registrado.</p>;
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="ml-4">
          <span
            className={cn(
              "absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background",
              entry.type === "event" ? "bg-blue-500" : "bg-muted-foreground"
            )}
          />
          <p className="text-sm font-medium">{entry.title}</p>
          {entry.description && (
            <p className="text-xs text-muted-foreground">{entry.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(entry.occurredAt).toLocaleString("pt-BR")}
          </p>
        </li>
      ))}
    </ol>
  );
}
