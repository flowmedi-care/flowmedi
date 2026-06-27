"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import { Button } from "@/components/ui/button";
import {
  MONO_CHART_SCALE,
  MONO_CHART_TREND,
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartTooltipStyle,
} from "@/components/dashboard-ui/chart-theme";
import { cn } from "@/lib/utils";
import type { VisaoGeralChartPoint } from "../actions";

type ChartGranularity = "day" | "week" | "month";

const GRANULARITY_OPTIONS: { value: ChartGranularity; label: string }[] = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
];

function getISOWeekKey(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function formatWeekLabel(weekKey: string): string {
  const [, w] = weekKey.split("-W");
  return `Sem ${w}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function aggregateChartData(
  data: VisaoGeralChartPoint[],
  granularity: ChartGranularity
): Array<VisaoGeralChartPoint & { trend?: number; periodAvg?: number }> {
  if (granularity === "day") {
    const withTrend = data.map((point, idx) => {
      const window = data.slice(Math.max(0, idx - 6), idx + 1);
      const avg = window.reduce((s, p) => s + p.total, 0) / window.length;
      return { ...point, trend: Number(avg.toFixed(1)) };
    });
    return withTrend;
  }

  const bucketKey = granularity === "week" ? getISOWeekKey : getMonthKey;
  const buckets = new Map<string, VisaoGeralChartPoint>();

  for (const point of data) {
    const key = bucketKey(point.dateKey);
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        dateKey: key,
        date: granularity === "week" ? formatWeekLabel(key) : formatMonthLabel(key),
        total: point.total,
        realizadas: point.realizadas,
        canceladas: point.canceladas,
        faltas: point.faltas,
      });
    } else {
      existing.total += point.total;
      existing.realizadas += point.realizadas;
      existing.canceladas += point.canceladas;
      existing.faltas += point.faltas;
    }
  }

  const aggregated = Array.from(buckets.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const periodAvg =
    aggregated.length > 0
      ? aggregated.reduce((s, p) => s + p.total, 0) / aggregated.length
      : 0;

  return aggregated.map((p) => ({
    ...p,
    periodAvg: Number(periodAvg.toFixed(1)),
  }));
}

export function ConsultasTrendChart({ chartData }: { chartData: VisaoGeralChartPoint[] }) {
  const [granularity, setGranularity] = useState<ChartGranularity>("day");

  const displayData = useMemo(
    () => aggregateChartData(chartData, granularity),
    [chartData, granularity]
  );

  const periodAverage =
    displayData.length > 0
      ? displayData.reduce((s, p) => s + p.total, 0) / displayData.length
      : 0;

  if (chartData.length === 0) return null;

  return (
    <ChartCard
      title="Consultas no período"
      description={
        granularity === "day"
          ? "Distribuição diária com média móvel de 7 dias sobre o total"
          : `Agregado por ${granularity === "week" ? "semana" : "mês"} com média do período`
      }
      actions={
        <div className="flex rounded-lg border border-border p-0.5">
          {GRANULARITY_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2.5 text-xs",
                granularity === opt.value && "bg-muted font-medium"
              )}
              onClick={() => setGranularity(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      }
    >
      <div className="h-[220px] w-full sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="date" {...chartAxisProps} interval="preserveStartEnd" />
            <YAxis {...chartAxisProps} allowDecimals={false} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number, name: string) => {
                if (name === "trend") return [value, "Média móvel (7d)"];
                if (name === "periodAvg") return [value, "Média do período"];
                return [value, name];
              }}
            />
            <Legend />
            {granularity !== "day" && periodAverage > 0 && (
              <ReferenceLine
                y={periodAverage}
                stroke={MONO_CHART_TREND}
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: `Média ${periodAverage.toFixed(1)}`,
                  position: "insideTopRight",
                  fill: MONO_CHART_TREND,
                  fontSize: 11,
                }}
              />
            )}
            <Bar dataKey="total" name="Total" fill={MONO_CHART_SCALE[0]} {...chartBarProps} />
            <Bar dataKey="realizadas" name="Realizadas" fill={MONO_CHART_SCALE[1]} {...chartBarProps} />
            <Bar dataKey="canceladas" name="Canceladas" fill={MONO_CHART_SCALE[2]} {...chartBarProps} />
            <Bar dataKey="faltas" name="Faltas" fill={MONO_CHART_SCALE[3]} {...chartBarProps} />
            {granularity === "day" && (
              <Line
                type="monotone"
                dataKey="trend"
                name="Média móvel (7d)"
                stroke={MONO_CHART_TREND}
                strokeWidth={2}
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
