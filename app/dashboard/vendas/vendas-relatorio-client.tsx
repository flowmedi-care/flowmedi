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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartCard } from "@/components/dashboard-ui/chart-card";
import { DataTable } from "@/components/dashboard-ui/data-table";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import { FilterBar } from "@/components/dashboard-ui/layout/filter-bar";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { PeriodRangePicker } from "@/components/dashboard-ui/period-range-picker";
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
} from "@/lib/vendas-reports";
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
        <FilterBar
          searchValue={patientSearch}
          onSearchChange={setPatientSearch}
          searchPlaceholder="Buscar paciente..."
          filters={
            <>
              <PeriodRangePicker period={period} onChange={handlePeriodChange} />
              <div className="flex flex-wrap gap-1">
                {STATUS_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={statusFilter.includes(opt.value) ? "secondary" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => toggleStatus(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <Select
                value={professionalId}
                onValueChange={(v) => {
                  setProfessionalId(v);
                }}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos profissionais</SelectItem>
                  {data.professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            </>
          }
        />

        {fetchError && <p className="text-sm text-destructive">{fetchError}</p>}
        {isPending && <p className="text-sm text-muted-foreground">Carregando…</p>}

        <p className="text-xs text-muted-foreground">
          {periodLabel} · {data.rows.length} registro(s)
        </p>

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
