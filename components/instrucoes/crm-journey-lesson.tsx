"use client";

import Link from "next/link";
import { ArrowRight, Thermometer, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CRM_JOURNEY_LESSON_SECTIONS,
  CRM_JOURNEY_FUNNEL_STAGES,
  CRM_JOURNEY_SCORE_RULES,
  CRM_JOURNEY_APP_LINKS,
  CRM_JOURNEY_INTRO,
  CRM_JOURNEY_LAYERS,
  CRM_JOURNEY_STORY,
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
          title="Por que o sistema mostra três visões?"
          description="Não é complicação — são três jeitos diferentes de olhar para a mesma pessoa, cada um com um propósito."
        >
          <div className="grid gap-5 lg:grid-cols-3">
            {CRM_JOURNEY_LAYERS.map((layer) => (
              <Card
                key={layer.id}
                className="border-border/60 bg-card/80 backdrop-blur-sm hover:border-primary/30 transition-colors"
              >
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">{layer.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {layer.description}
                  </p>
                  <div className="flex gap-2 rounded-lg bg-muted/40 p-3 text-sm text-foreground/90">
                    <Lightbulb className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    <span>{layer.analogy}</span>
                  </div>
                  <a
                    href={`#${layer.anchor}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Ver na prática
                    <ArrowRight className="h-3.5 w-3.5" />
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
          title="O funil — as 6 etapas grandes"
          description="Cada pessoa fica em uma coluna só. É a visão mais simples: onde ela está na jornada de virar paciente."
        >
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {CRM_JOURNEY_FUNNEL_STAGES.map((row) => (
              <Card key={row.stage} className="border-border/60 overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-primary/5 border-b border-border/40 px-4 py-3">
                    <p className="font-semibold text-foreground">{row.label}</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">{row.criteria}</p>
                    {row.example && (
                      <p className="text-xs text-foreground/80 italic border-l-2 border-primary/30 pl-3">
                        Ex.: {row.example}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm text-foreground/90">
            <strong>Importante:</strong> a pessoa só vira <strong>Cliente</strong> quando comparece
            e realiza a primeira consulta — não basta ter agendado.
          </div>
        </LessonSectionBlock>
      </RevealSection>

      <RevealSection>
        <LessonSectionBlock
          id="historia"
          title="O caminho completo, contado como história"
          description="Antes do mapa técnico, veja o fluxo como a equipe vive no dia a dia."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CRM_JOURNEY_STORY.map((item) => (
              <div
                key={item.step}
                className="relative rounded-xl border border-border/60 bg-card/50 p-5 pl-14"
              >
                <span className="absolute left-4 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {item.step}
                </span>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </LessonSectionBlock>
      </RevealSection>

      <RevealSection>
        <LessonSectionBlock
          id="mapa"
          title="Mapa interativo — todos os passos"
          description="Clique em qualquer caixa para entender o que significa e o que fazer. Os caminhos alternativos (falta, orçamento recusado) aparecem quando a pessoa não segue o fluxo ideal."
        >
          <InstructionFlowExplorer />
        </LessonSectionBlock>
      </RevealSection>

      <RevealSection>
        <LessonSectionBlock
          id="score"
          title="Quem atender primeiro?"
          description="O sistema dá uma nota de 0 a 100 para ajudar a priorizar. Quanto mais quente, mais urgente o retorno."
        >
          <div className="flex flex-wrap gap-3 mb-6">
            {(["frio", "morno", "quente"] as LeadTemperature[]).map((t) => (
              <Badge
                key={t}
                variant="outline"
                className={`${TEMPERATURE_COLORS[t]} gap-1.5 text-sm py-1.5 px-3`}
              >
                <Thermometer className="h-3.5 w-3.5" />
                {TEMPERATURE_LABELS[t]}
                {t === "frio" && " — pode esperar um pouco"}
                {t === "morno" && " — retornar em breve"}
                {t === "quente" && " — prioridade alta"}
              </Badge>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {CRM_JOURNEY_SCORE_RULES.map((rule) => (
              <div
                key={rule.label}
                className="rounded-xl border border-border/60 p-4 flex gap-4 items-start"
              >
                <span
                  className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
                    rule.points < 0 ? "text-destructive" : "text-primary"
                  }`}
                >
                  {rule.points > 0 ? "+" : ""}
                  {rule.points}
                </span>
                <div>
                  <p className="font-medium text-foreground text-sm">{rule.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">{rule.plainText}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground max-w-3xl">
            A equipe pode mudar a temperatura manualmente quando souber algo que o sistema não vê
            — por exemplo, se o lead é parente de um paciente VIP.
          </p>
        </LessonSectionBlock>
      </RevealSection>

      <RevealSection>
        <LessonSectionBlock
          id="onde-mexer"
          title="Onde fazer cada coisa no app"
          description="Atalhos diretos para as telas que você usa no dia a dia."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {CRM_JOURNEY_APP_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group rounded-xl border border-border/60 p-5 hover:border-primary/40 hover:bg-muted/20 hover:shadow-sm transition-all h-full flex flex-col"
              >
                <p className="font-semibold group-hover:text-primary transition-colors">
                  {link.label}
                </p>
                <p className="text-sm text-muted-foreground mt-2 flex-1 leading-relaxed">
                  {link.description}
                </p>
                <span className="inline-flex items-center gap-1 text-sm text-primary mt-4 font-medium">
                  Abrir
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </LessonSectionBlock>
      </RevealSection>
    </InstructionLessonLayout>
  );
}
