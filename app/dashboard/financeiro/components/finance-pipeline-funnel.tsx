"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtCurrency } from "@/lib/financeiro/format";
import type { ForecastResult, PipelineStageKey } from "@/lib/business-pipeline/types";
import { STAGE_LABELS } from "@/lib/business-pipeline/types";
import { cn } from "@/lib/utils";

type Mode = "competencia" | "caixa" | "context";

function StageBlock({
  label,
  amount,
  dropPct,
  cause,
  isLast,
}: {
  label: string;
  amount: number;
  dropPct?: number;
  cause?: string;
  isLast?: boolean;
}) {
  return (
    <div className="flex flex-col items-stretch gap-1 min-w-0 flex-1">
      <div className="rounded-lg border bg-card p-3 space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-xl font-semibold tabular-nums tracking-tight">{fmtCurrency(amount)}</p>
      </div>
      {!isLast && dropPct != null && (
        <div className="px-1 py-1 text-center">
          <p
            className={cn(
              "text-xs font-medium tabular-nums",
              dropPct > 10 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
            )}
          >
            ↓ {dropPct > 0 ? `−${dropPct.toFixed(0)}%` : "—"}
          </p>
          {cause && cause !== "—" && (
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{cause}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function FinancePipelineFunnel({
  forecast,
  mode,
}: {
  forecast: ForecastResult;
  mode: Mode;
}) {
  const stages: { key: PipelineStageKey; amount: number }[] =
    mode === "competencia"
      ? [
          { key: "agendado", amount: forecast.agendado },
          { key: "previsto", amount: forecast.previsto },
          { key: "faturado", amount: forecast.faturado },
        ]
      : mode === "caixa"
        ? [
            { key: "faturado", amount: forecast.faturado },
            { key: "recebido", amount: forecast.recebido },
          ]
        : [
            { key: "agendado", amount: forecast.agendado },
            { key: "previsto", amount: forecast.previsto },
          ];

  const dropByPair = new Map(
    forecast.pipelineHealth.map((d) => [`${d.from}->${d.to}`, d])
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {mode === "competencia"
              ? "Pipeline de faturamento"
              : mode === "caixa"
                ? "Pipeline de recebimento"
                : "Contexto da agenda"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {mode === "competencia"
              ? "Onde o faturamento se forma — e onde cai."
              : mode === "caixa"
                ? "Do faturado ao dinheiro em caixa."
                : "Agendado e previsto (não é caixa)."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            Comparecimento {forecast.attendanceRatePct.toFixed(0)}%
          </Badge>
          <Badge variant="outline">{forecast.confidence.label}</Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {stages.map((s, i) => {
          const next = stages[i + 1];
          const drop = next ? dropByPair.get(`${s.key}->${next.key}`) : undefined;
          return (
            <StageBlock
              key={s.key}
              label={STAGE_LABELS[s.key]}
              amount={s.amount}
              dropPct={drop?.dropPct}
              cause={drop?.cause}
              isLast={i === stages.length - 1}
            />
          );
        })}
        {mode === "caixa" && forecast.saldo != null && (
          <StageBlock label="Saldo" amount={forecast.saldo} isLast />
        )}
      </div>

      {mode === "competencia" && (
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Comparecimento</p>
              <p className="font-semibold tabular-nums">
                {forecast.conversions.comparecimentoPct.toFixed(0)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Faturamento</p>
              <p className="font-semibold tabular-nums">
                {forecast.conversions.faturamentoPct.toFixed(0)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Recebimento</p>
              <p className="font-semibold tabular-nums">
                {forecast.conversions.recebimentoPct.toFixed(0)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {forecast.confidence.rationale}
        {forecast.accuracy
          ? ` · Precisão ${forecast.accuracy.pct.toFixed(0)}% (base: ${forecast.accuracy.sampleSize} consultas)`
          : ""}
        {forecast.assumptions.length > 0 ? ` · ${forecast.assumptions.join(" · ")}` : ""}
      </p>
    </section>
  );
}
