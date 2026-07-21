"use client";

import { StatCard } from "@/components/dashboard-ui/stat-card";
import { fmtCurrency } from "@/lib/financeiro/format";
import type { PerformanceMetrics } from "@/lib/business-pipeline/types";

export function FinanceiroPerformanceClient({
  metrics,
}: {
  metrics: PerformanceMetrics | null;
}) {
  if (!metrics) {
    return (
      <p className="text-sm text-muted-foreground">
        Ainda não há dados suficientes para a visão de performance.
      </p>
    );
  }

  const mom = metrics.receitaMomPct;
  const momLabel = `${mom >= 0 ? "+" : ""}${mom.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Receita vs mês anterior"
          value={momLabel}
          subtitle={`${fmtCurrency(metrics.receitaAtual)} neste mês · ${fmtCurrency(metrics.receitaAnterior)} no anterior`}
          iconColor={mom >= 0 ? "success" : "destructive"}
        />
        <StatCard
          title="No-show"
          value={`${metrics.noShowPct.toFixed(1)}%`}
          subtitle={`Base: ${metrics.sampleSize} consultas (90d)`}
          iconColor={metrics.noShowPct > 15 ? "warning" : "primary"}
        />
        <StatCard
          title="Tempo médio até receber"
          value={
            metrics.tempoMedioReceberDias != null
              ? `${metrics.tempoMedioReceberDias.toFixed(1)} dias`
              : "—"
          }
          subtitle="Da emissão da comanda ao pagamento"
          iconColor="info"
        />
        <StatCard
          title="Receita do mês"
          value={fmtCurrency(metrics.receitaAtual)}
          subtitle="Competência — faturado"
          iconColor="primary"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Lente Performance — comparar com o período anterior. Não mistura caixa com competência.
      </p>
    </div>
  );
}
