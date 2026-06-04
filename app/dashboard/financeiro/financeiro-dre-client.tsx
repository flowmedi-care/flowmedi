// FINANCEIRO FASE 1 — ITEM 6: DRE reformulada

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PeriodSelector } from "./components/period-selector";
import { fmtCurrency, downloadCsv } from "@/lib/financeiro/format";
import type { DreReport } from "@/lib/financeiro/types";
import { cn } from "@/lib/utils";

export function FinanceiroDreClient({ report }: { report: DreReport }) {
  function exportCsv() {
    downloadCsv(`dre-${report.year}-${report.month}.csv`, [
      ["Linha", "Valor"],
      ...report.lines.map((l) => [l.label, String(l.value)]),
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PeriodSelector year={report.year} month={report.month} />
        <Button variant="outline" onClick={exportCsv}>
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-1">
          <h2 className="text-lg font-semibold mb-1">
            Demonstrativo de Resultado — {report.monthLabel}
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Lente: <strong>Competência</strong> (receita faturada) + despesas operacionais por caixa
          </p>

          {report.lines.map((line) => (
            <div
              key={line.key}
              className={cn(
                "flex justify-between py-2 border-b last:border-0 gap-4",
                line.isTotal && "font-semibold text-base pt-3",
                line.level === 1 && "pl-4 text-sm text-muted-foreground"
              )}
              title={line.tooltip}
            >
              <span>{line.label}</span>
              <span
                className={cn(
                  line.key === "resultado" || line.key === "margem_bruta" || line.key === "receita_liquida"
                    ? line.value >= 0
                      ? "text-green-700 dark:text-green-400"
                      : "text-destructive"
                    : ""
                )}
              >
                {fmtCurrency(line.value)}
              </span>
            </div>
          ))}

          <p className="text-xs text-muted-foreground pt-6 italic">
            Este demonstrativo é simplificado e não substitui a contabilidade formal. Consulte seu
            contador para fins fiscais.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
