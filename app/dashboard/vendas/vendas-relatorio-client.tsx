"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import { DataTable } from "@/components/dashboard-ui/data-table";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { PageToolbar } from "@/components/dashboard-ui/toolbar/page-toolbar";
import { FilterGroup } from "@/components/dashboard-ui/filters/filter-group";
import { PeriodFilter } from "@/components/dashboard-ui/filters/period-filter";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  MONO_CHART_SCALE,
  chartAxisProps,
  chartBarProps,
  chartGridProps,
  chartTooltipStyle,
} from "@/components/dashboard-ui/chart-theme";
import {
  getComandaStatusLabel,
  getComandaStatusVariant,
} from "@/lib/vendas/status-badges";
import {
  getVendasRelatorioDetalhado,
} from "./vendas-actions";
import type { VendasRelatorioData, VendasRelatorioFilters } from "@/lib/vendas/types";
import type { ComandaStatus } from "@/lib/vendas/types";
import {
  type FunnelPeriod,
  formatPeriodRangeLabel,
} from "@/lib/analytics/time-buckets";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_OPTIONS: { value: ComandaStatus; label: string }[] = [
  { value: "aberta", label: "Aberta" },
  { value: "parcial", label: "Parcial" },
  { value: "paga", label: "Paga" },
];

type VendasRelatorioClientProps = {
  initialData: VendasRelatorioData;
};

export function VendasRelatorioClient({ initialData }: VendasRelatorioClientProps) {
  const [period, setPeriod] = useState<FunnelPeriod>(initialData.period);
  const [data, setData] = useState(initialData);
  const [statusFilter, setStatusFilter] = useState<ComandaStatus[]>([]);
  const [professionalId, setProfessionalId] = useState<string>("all");
  const [patientSearch, setPatientSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = (
    nextPeriod: FunnelPeriod,
    filters: VendasRelatorioFilters
  ) => {
    startTransition(async () => {
      const res = await getVendasRelatorioDetalhado(nextPeriod, filters);
      if (res.error) {
        setFetchError(res.error);
        return;
      }
      setFetchError(null);
      if (res.data) setData(res.data);
    });
  };

  const buildFilters = (): VendasRelatorioFilters => ({
    status: statusFilter.length ? statusFilter : undefined,
    professionalId: professionalId !== "all" ? professionalId : undefined,
    patientSearch: patientSearch.trim() || undefined,
  });

  const handlePeriodChange = (next: FunnelPeriod) => {
    setPeriod(next);
    fetchData(next, buildFilters());
  };

  const handleFilterChange = () => {
    fetchData(period, buildFilters());
  };

  const toggleStatus = (status: ComandaStatus) => {
    setStatusFilter((prev) => {
      const next = prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status];
      return next;
    });
  };

  const periodLabel = formatPeriodRangeLabel(period);

  const tableRows = useMemo(
    () =>
      data.rows.map((row) => ({
        ...row,
        data: new Date(row.created_at).toLocaleDateString("pt-BR"),
      })),
    [data.rows]
  );

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Vendas", href: "/dashboard/vendas" }, { label: "Relatório" }],
        title: "Relatório de vendas",
        description: "Comandas detalhadas com filtros, status e análise por procedimento, profissional e paciente.",
      }}
    >
      <div className="space-y-6">
        <PageToolbar>
          <PageToolbar.Filters>
            <FilterGroup>
              <div className="relative w-full min-w-[200px] sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Buscar paciente..."
                  className="h-9 w-full pl-9 text-sm bg-background border-border/60 shadow-none"
                />
              </div>
              <PeriodFilter mode="range" value={period} onChange={handlePeriodChange} />
              <div
                className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-muted/60 p-1"
                role="group"
                aria-label="Status"
              >
                {STATUS_OPTIONS.map((opt) => {
                  const active = statusFilter.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleStatus(opt.value)}
                      className={
                        active
                          ? "inline-flex h-7 items-center rounded-md bg-card px-2.5 text-xs font-medium text-foreground shadow-sm"
                          : "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <Select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                className="h-9 w-[180px]"
              >
                <option value="all">Todos profissionais</option>
                {data.professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </FilterGroup>
          </PageToolbar.Filters>
          <PageToolbar.Actions>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-9"
              onClick={handleFilterChange}
              disabled={isPending}
            >
              Aplicar filtros
            </Button>
          </PageToolbar.Actions>
          <PageToolbar.Meta>
            {isPending
              ? "Carregando…"
              : `${periodLabel} · ${data.rows.length} registro(s)`}
          </PageToolbar.Meta>
        </PageToolbar>

        {fetchError && <p className="text-sm text-destructive">{fetchError}</p>}

        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Por procedimento/serviço" description="Top itens faturados">
            {data.byProcedimento.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byProcedimento.slice(0, 6)} layout="vertical" margin={{ left: 4 }}>
                    <CartesianGrid {...chartGridProps} />
                    <XAxis type="number" {...chartAxisProps} tickFormatter={(v) => fmt(Number(v))} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip {...chartTooltipStyle} formatter={(v: number) => [fmt(v), "Receita"]} />
                    <Bar dataKey="total" fill={MONO_CHART_SCALE[0]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Por profissional" description="Receita faturada">
            {data.byProfissional.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byProfissional.slice(0, 6)} layout="vertical" margin={{ left: 4 }}>
                    <CartesianGrid {...chartGridProps} />
                    <XAxis type="number" {...chartAxisProps} tickFormatter={(v) => fmt(Number(v))} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip {...chartTooltipStyle} formatter={(v: number) => [fmt(v), "Receita"]} />
                    <Bar dataKey="total" fill={MONO_CHART_SCALE[1]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Top pacientes" description="Maior valor faturado">
            {data.byPaciente.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byPaciente.slice(0, 6)} layout="vertical" margin={{ left: 4 }}>
                    <CartesianGrid {...chartGridProps} />
                    <XAxis type="number" {...chartAxisProps} tickFormatter={(v) => fmt(Number(v))} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip {...chartTooltipStyle} formatter={(v: number) => [fmt(v), "Receita"]} />
                    <Bar dataKey="total" fill={MONO_CHART_SCALE[2]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        {tableRows.length === 0 ? (
          <EmptyState title="Sem comandas no período" />
        ) : (
          <DataTable
            columns={[
              {
                key: "data",
                header: "Data",
                cell: (row) => row.data,
              },
              {
                key: "paciente",
                header: "Paciente",
                cell: (row) => row.patient_name,
              },
              {
                key: "profissional",
                header: "Profissional",
                cell: (row) => row.professional_name,
              },
              {
                key: "total",
                header: "Total",
                cell: (row) => fmt(row.total_amount),
              },
              {
                key: "pago",
                header: "Pago",
                cell: (row) => fmt(row.paid_amount),
              },
              {
                key: "saldo",
                header: "Saldo",
                cell: (row) => (
                  <span className={row.balance > 0 ? "text-warning-muted-foreground font-medium" : ""}>
                    {fmt(row.balance)}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: (row) => (
                  <Badge variant={getComandaStatusVariant(row.status)}>
                    {getComandaStatusLabel(row.status)}
                  </Badge>
                ),
              },
              {
                key: "tags",
                header: "Tags",
                cell: (row) => (
                  <div className="flex flex-wrap gap-1">
                    {row.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ),
              },
              {
                key: "acao",
                header: "",
                cell: () => (
                  <Link
                    href="/dashboard/financeiro/receber"
                    className="text-xs text-primary hover:underline"
                  >
                    Ver cobrança
                  </Link>
                ),
              },
            ]}
            data={tableRows}
            getRowKey={(row) => row.id}
          />
        )}
      </div>
    </PageShell>
  );
}
