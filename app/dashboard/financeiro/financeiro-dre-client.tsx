"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PeriodFilter,
  useMonthPeriodUrl,
} from "@/components/dashboard-ui/filters/period-filter";
import { PageToolbar } from "@/components/dashboard-ui/toolbar/page-toolbar";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import { fmtCurrency, downloadCsv } from "@/lib/financeiro/format";
import { drePercentOfRevenue } from "@/lib/financeiro/dre-structure";
import { upsertClinicFinancialSettings } from "@/lib/financeiro/analytics";
import type { DreReport, ClinicFinancialSettings } from "@/lib/financeiro/types";
import { cn } from "@/lib/utils";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartAxisProps, chartTooltipStyle, CHART_PALETTE } from "@/components/dashboard-ui/chart-theme";
import { toast } from "@/components/ui/toast";
import { Settings2 } from "lucide-react";

export function FinanceiroDreClient({
  report,
  initialSettings,
}: {
  report: DreReport;
  initialSettings: ClinicFinancialSettings;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);

  const receitaBruta = report.lines.find((l) => l.key === "receita_bruta")?.value ?? 0;
  const pctData = drePercentOfRevenue(report.lines, receitaBruta);

  function exportCsv() {
    downloadCsv(`dre-${report.year}-${report.month}.csv`, [
      ["Linha", "Valor"],
      ...report.lines.map((l) => [l.label, String(l.value)]),
    ]);
  }

  async function saveSettings() {
    setSaving(true);
    const res = await upsertClinicFinancialSettings(settings);
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Provisões atualizadas.", "success");
      setSettingsOpen(false);
    }
  }

  const monthPeriod = useMonthPeriodUrl(report.year, report.month);
  const totalKeys = ["receita_liquida", "lucro_bruto", "ebitda", "lair", "resultado_liquido"];

  return (
    <div className="space-y-6">
      <PageToolbar>
        <PageToolbar.Filters>
          <PeriodFilter
            mode="month"
            value={monthPeriod.value}
            onChange={monthPeriod.onChange}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 shadow-none"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings2 className="h-4 w-4 mr-1" />
                  Configurar provisões
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 shadow-none"
                  onClick={exportCsv}
                >
                  Exportar CSV
                </Button>
              </>
            }
          />
        </PageToolbar.Filters>
      </PageToolbar>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6 space-y-1">
            <h2 className="text-lg font-semibold mb-1">DRE — {report.monthLabel}</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Receita por competência · Despesas por caixa · CMV por custo real
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
                    totalKeys.includes(line.key)
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
              Demonstrativo gerencial — não substitui contabilidade formal ou NF-e.
            </p>
          </CardContent>
        </Card>

        {pctData.length > 0 && (
          <ChartCard title="% sobre receita bruta" description="Composição das principais linhas">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={pctData} layout="vertical">
                <XAxis type="number" unit="%" {...chartAxisProps} />
                <YAxis type="category" dataKey="label" width={140} {...chartAxisProps} />
                <Tooltip {...chartTooltipStyle} formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Bar dataKey="pct" fill={CHART_PALETTE[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent title="Provisões DRE" onClose={() => setSettingsOpen(false)}>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>PECLD (% sobre contas a receber)</Label>
              <Input
                type="number"
                step="0.1"
                value={settings.pecld_percent_ar}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, pecld_percent_ar: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>IR e CSLL (% sobre LAIR — 0 = manual)</Label>
              <Input
                type="number"
                step="0.1"
                value={settings.ir_csll_percent_lair}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, ir_csll_percent_lair: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
            <Button className="w-full" onClick={saveSettings} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
