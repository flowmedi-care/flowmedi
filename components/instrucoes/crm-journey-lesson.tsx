"use client";

import Link from "next/link";
import { ArrowRight, Thermometer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CRM_JOURNEY_LESSON_SECTIONS,
  CRM_JOURNEY_FUNNEL_STAGES,
  CRM_JOURNEY_SCORE_RULES,
  CRM_JOURNEY_APP_LINKS,
  CRM_JOURNEY_INTRO,
  CRM_JOURNEY_LAYERS,
} from "@/lib/instrucoes/crm-journey-lesson";
import { TEMPERATURE_LABELS } from "@/lib/leads/scoring";
import type { LeadTemperature } from "@/lib/leads/scoring";
import {
  InstructionLessonLayout,
  LessonSectionBlock,
} from "./instruction-lesson-layout";
import { InstructionFlowExplorer } from "./instruction-flow-explorer";
import { RevealSection } from "./use-reveal-on-scroll";

const TEMPERATURE_COLORS: Record<LeadTemperature, string> = {
  frio: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300",
  morno: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  quente: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300",
};

export function CrmJourneyLesson() {
  return (
    <InstructionLessonLayout
      title={CRM_JOURNEY_INTRO.title}
      subtitle={CRM_JOURNEY_INTRO.subtitle}
      durationMin={CRM_JOURNEY_INTRO.durationMin}
      sections={CRM_JOURNEY_LESSON_SECTIONS}
    >
      <RevealSection>
        <LessonSectionBlock
          id="camadas"
          title="Por que três camadas?"
          description="O Flowmedi separa visão de gestão, operação do dia a dia e priorização — sem misturar conceitos."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {CRM_JOURNEY_LAYERS.map((layer) => (
              <Card
                key={layer.id}
                className="border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/30 transition-colors"
              >
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground">{layer.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{layer.description}</p>
                  <a
                    href={`#${layer.anchor}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary mt-3 hover:underline"
                  >
                    Ver seção
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </LessonSectionBlock>
      </RevealSection>

      <RevealSection>
        <LessonSectionBlock
          id="funil"
          title="Camada 1 — Funil CRM"
          description="Seis etapas lineares. Cada contato está em uma só coluna do kanban."
        >
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-semibold">Etapa</th>
                  <th className="text-left p-3 font-semibold">Quando entra</th>
                </tr>
              </thead>
              <tbody>
                {CRM_JOURNEY_FUNNEL_STAGES.map((row) => (
                  <tr key={row.stage} className="border-b border-border/40 last:border-0">
                    <td className="p-3 font-medium whitespace-nowrap">{row.label}</td>
                    <td className="p-3 text-muted-foreground">{row.criteria}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            A conversão em <strong>Cliente</strong> acontece na primeira consulta realizada
            (comparecimento), não no agendamento.
          </p>
        </LessonSectionBlock>
      </RevealSection>

      <RevealSection>
        <LessonSectionBlock
          id="mapa"
          title="Camada 2 — Jornada operacional"
          description="O mapa abaixo mostra todas as fases e ramificações: orçamento, falta, pagamento, repescagem."
        >
          <InstructionFlowExplorer />
        </LessonSectionBlock>
      </RevealSection>

      <RevealSection>
        <LessonSectionBlock
          id="score"
          title="Camada 3 — Score híbrido"
          description="Pontuação automática de 0 a 100 com temperatura. A equipe pode sobrescrever manualmente."
        >
          <div className="flex flex-wrap gap-2 mb-4">
            {(["frio", "morno", "quente"] as LeadTemperature[]).map((t) => (
              <Badge
                key={t}
                variant="outline"
                className={`${TEMPERATURE_COLORS[t]} gap-1`}
              >
                <Thermometer className="h-3 w-3" />
                {TEMPERATURE_LABELS[t]}
                {t === "frio" && " (0–33)"}
                {t === "morno" && " (34–66)"}
                {t === "quente" && " (67–100)"}
              </Badge>
            ))}
          </div>
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-semibold">Sinal</th>
                  <th className="text-right p-3 font-semibold w-24">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {CRM_JOURNEY_SCORE_RULES.map((rule) => (
                  <tr key={rule.label} className="border-b border-border/40 last:border-0">
                    <td className="p-3 text-muted-foreground">{rule.label}</td>
                    <td
                      className={`p-3 text-right font-mono font-medium ${
                        rule.points < 0 ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {rule.points > 0 ? "+" : ""}
                      {rule.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            O override de temperatura prevalece sobre o cálculo automático — útil quando a equipe
            conhece o contexto e quer priorizar manualmente.
          </p>
        </LessonSectionBlock>
      </RevealSection>

      <RevealSection>
        <LessonSectionBlock
          id="onde-mexer"
          title="Onde mexer no app"
          description="Atalhos para as telas onde cada parte do fluxo acontece."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {CRM_JOURNEY_APP_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group rounded-xl border border-border/60 p-4 hover:border-primary/40 hover:bg-muted/20 transition-all"
              >
                <p className="font-medium group-hover:text-primary transition-colors">
                  {link.label}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
                <span className="inline-flex items-center gap-1 text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  Abrir
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </LessonSectionBlock>
      </RevealSection>
    </InstructionLessonLayout>
  );
}
