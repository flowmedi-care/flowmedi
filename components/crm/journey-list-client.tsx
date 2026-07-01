"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getStepDefinition,
  JOURNEY_PHASE_LABELS,
  JOURNEY_SOURCE_LABELS,
  type ContactJourney,
  type JourneyPhase,
  type JourneySource,
  type LifecycleStageCode,
} from "@/lib/contact-journey";
import { CONTACT_INTENT_LABELS } from "@/lib/contact-journey/intents";
import { LIFECYCLE_STAGE_LABELS } from "@/lib/leads/lifecycle";
import { ChevronRight, Clock, FileText, Globe, MessageSquare, User } from "lucide-react";

const SOURCE_ICONS: Record<string, typeof FileText> = {
  form: FileText,
  whatsapp: MessageSquare,
  whatsapp_direct: MessageSquare,
  whatsapp_ads: MessageSquare,
  site: Globe,
  public_site: Globe,
  manual: User,
};

function SourceBadge({ source }: { source: JourneySource }) {
  const Icon = SOURCE_ICONS[source] ?? User;
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon className="h-3 w-3" />
      {JOURNEY_SOURCE_LABELS[source] ?? source}
    </Badge>
  );
}

function formatIdleTime(updatedAt: string): string {
  const diff = Date.now() - new Date(updatedAt).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Atualizado há pouco";
  if (hours < 24) return `Parado há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Parado há ${days}d`;
}

type JourneyListClientProps = {
  journeys: ContactJourney[];
  phaseFilter?: JourneyPhase;
  sourceFilter?: JourneySource;
  withActionOnly?: boolean;
};

export function JourneyListClient({ journeys }: JourneyListClientProps) {
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
        const awaitsResponse = j.activePathSteps.some(
          (s) => s.status === "current" && s.awaitsResponse
        );

        return (
          <Link key={j.contactKey} href={`/dashboard/crm/jornada/${j.contactKey}`}>
            <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
              <CardContent className="py-4 flex flex-wrap items-center gap-3 justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-medium truncate">{j.displayName}</p>
                    <Badge variant="secondary" className="font-normal">
                      {CONTACT_INTENT_LABELS[j.contactIntent]}
                    </Badge>
                    <SourceBadge source={j.source} />
                    <Badge variant="outline" className="font-normal">
                      {JOURNEY_PHASE_LABELS[j.phase]}
                    </Badge>
                    {j.lifecycleStage && (
                      <Badge variant="outline" className="font-normal">
                        {LIFECYCLE_STAGE_LABELS[j.lifecycleStage as LifecycleStageCode]}
                      </Badge>
                    )}
                    {awaitsResponse && (
                      <Badge className="font-normal gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200">
                        <Clock className="h-3 w-3" />
                        Aguardando resposta
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Etapa: <span className="text-foreground">{step.label}</span>
                    {j.phone && <> · {j.phone}</>}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    {j.suggestedAction && (
                      <p className="text-xs text-primary">Próximo: {j.suggestedAction.label}</p>
                    )}
                    <p className={cn("text-xs text-muted-foreground")}>
                      {formatIdleTime(j.updatedAt)}
                    </p>
                  </div>
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
