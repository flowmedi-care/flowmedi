"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CalendarClock, Plus, Search, CalendarRange, Tags, Activity, Stethoscope, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusBadgeClassName } from "../agenda/status-utils";
import type { ConsultaRow } from "./page";

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_OPTIONS = [
  { value: "agendada", label: "Agendada" },
  { value: "confirmada", label: "Confirmada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "realizada", label: "Realizada" },
  { value: "falta", label: "Falta" },
] as const;

const PERIOD_OPTIONS = [
  { value: "hoje", label: "Hoje" },
  { value: "7dias", label: "7 dias" },
  { value: "mes", label: "Mês" },
  { value: "personalizado", label: "Personalizado" },
] as const;

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfDay(ymd: string) {
  return new Date(ymd + "T00:00:00");
}

function endOfDay(ymd: string) {
  return new Date(ymd + "T23:59:59.999");
}

export function ConsultaClient({
  consultas,
  patients,
  doctors,
  appointmentTypes,
  procedures,
  formTemplates,
  pricingDimensions,
  pricingDimensionValues,
}: {
  consultas: ConsultaRow[];
  patients: { id: string; full_name: string }[];
  doctors: { id: string; full_name: string | null }[];
  appointmentTypes: { id: string; name: string }[];
  procedures: { id: string; name: string; recommendations: string | null }[];
  formTemplates: { id: string; name: string }[];
  pricingDimensions: { id: string; nome: string }[];
  pricingDimensionValues: { id: string; dimension_id: string; nome: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const patientId = searchParams.get("patientId") ?? "";
    const doctorId = searchParams.get("doctorId") ?? "";
    const newParam = searchParams.get("new") ?? searchParams.get("novaConsulta");
    if (newParam === "true" || newParam === "1" || patientId || doctorId) {
      const params = new URLSearchParams();
      params.set("new", "true");
      if (patientId) params.set("patientId", patientId);
      if (doctorId) params.set("doctorId", doctorId);
      router.replace(`/dashboard/agenda?${params.toString()}`, { scroll: false });
    }
  }, [searchParams, router]);

  const filteredPatientId = searchParams.get("filterPatientId") ?? "";
  const filteredPatient = patients.find((p) => p.id === filteredPatientId) ?? null;

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]["value"]>("mes");
  const [customFrom, setCustomFrom] = useState(() => toYMD(new Date()));
  const [customTo, setCustomTo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return toYMD(d);
  });
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [doctorFilter, setDoctorFilter] = useState<string>("");
  const [dimensionFilter, setDimensionFilter] = useState<string>("");
  const [dimensionValueFilter, setDimensionValueFilter] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!dimensionFilter) {
      setDimensionValueFilter("");
      return;
    }
    if (dimensionValueFilter) {
      const found = pricingDimensionValues.find((v) => v.id === dimensionValueFilter);
      if (!found || found.dimension_id !== dimensionFilter) {
        setDimensionValueFilter("");
      }
    }
  }, [dimensionFilter, dimensionValueFilter, pricingDimensionValues]);

  const filtered = useMemo(() => {
    let list = [...consultas];

    // Busca por nome ou telefone
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const searchDigits = q.replace(/\D/g, "");
      list = list.filter((c) => {
        const matchName = c.patient.full_name.toLowerCase().includes(q);
        const matchPhone =
          c.patient.phone &&
          (c.patient.phone.toLowerCase().includes(q) ||
            (searchDigits.length >= 4 && c.patient.phone.replace(/\D/g, "").includes(searchDigits)));
        return matchName || matchPhone;
      });
    }

    // Período
    const now = new Date();
    let start: Date;
    let end: Date;
    if (period === "hoje") {
      const today = toYMD(now);
      start = startOfDay(today);
      end = endOfDay(today);
    } else if (period === "7dias") {
      start = startOfDay(toYMD(now));
      end = new Date(now);
      end.setDate(end.getDate() + 6);
      end = endOfDay(toYMD(end));
    } else if (period === "mes") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      start = startOfDay(customFrom);
      end = endOfDay(customTo);
    }
    list = list.filter((c) => {
      const t = new Date(c.scheduled_at).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
    if (period === "personalizado" && start.getTime() > end.getTime()) {
      list = [];
    }

    // Status
    if (statusFilter) {
      list = list.filter((c) => c.status === statusFilter);
    }

    // Tipo
    if (typeFilter) {
      list = list.filter((c) => c.appointment_type?.id === typeFilter);
    }

    // Profissional
    if (doctorFilter) {
      list = list.filter((c) => c.doctor?.id === doctorFilter);
    }

    // Dimensão / valor de dimensão
    if (dimensionFilter) {
      const valueIdsForDimension = new Set(
        pricingDimensionValues
          .filter((v) => v.dimension_id === dimensionFilter)
          .map((v) => v.id)
      );
      list = list.filter((c) => {
        const ids = c.dimension_value_ids ?? [];
        if (ids.length === 0) return false;
        if (dimensionValueFilter) return ids.includes(dimensionValueFilter);
        return ids.some((id) => valueIdsForDimension.has(id));
      });
    }

    // Paciente (filtro vindo do painel de pacientes)
    if (filteredPatientId) {
      list = list.filter((c) => c.patient.id === filteredPatientId);
    }

    // Já vem ordenado por scheduled_at do servidor; manter
    list.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return list;
  }, [
    consultas,
    search,
    period,
    customFrom,
    customTo,
    statusFilter,
    typeFilter,
    doctorFilter,
    dimensionFilter,
    dimensionValueFilter,
    filteredPatientId,
    pricingDimensionValues,
  ]);

  const showDoctorFilter = doctors.length > 1;
  const activeFiltersCount = [
    statusFilter !== "",
    typeFilter !== "",
    doctorFilter !== "",
    dimensionFilter !== "",
    dimensionValueFilter !== "",
  ].filter(Boolean).length;
  const dimensionValueOptions = pricingDimensionValues.filter(
    (v) => !dimensionFilter || v.dimension_id === dimensionFilter
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Consulta</h1>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="icon"
            variant={activeFiltersCount > 0 ? "secondary" : "outline"}
            className={cn("h-10 w-10 rounded-full", activeFiltersCount > 0 && "relative")}
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label="Abrir filtros de consulta"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] leading-[18px] text-center px-1 font-semibold">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          <Button
            size="icon"
            className="h-10 w-10 rounded-full sm:hidden"
            type="button"
            onClick={() => router.push("/dashboard/agenda?new=true")}
            aria-label="Nova consulta"
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Button
            className="hidden sm:inline-flex min-h-[44px] touch-manipulation"
            type="button"
            onClick={() => router.push("/dashboard/agenda?new=true")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova consulta
          </Button>
        </div>
      </div>

      {/* Formulário unificado na Agenda — ambos os botões "Nova consulta" levam à mesma tela */}

      {filteredPatientId && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>
            Filtrando consultas do paciente:{" "}
            <strong>{filteredPatient?.full_name ?? "Paciente selecionado"}</strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/consulta")}
            className="h-7 px-2"
          >
            Limpar filtro
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-center gap-2 min-w-0">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Busca por nome ou telefone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="flex flex-col gap-2 sm:min-w-[420px]">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as (typeof PERIOD_OPTIONS)[number]["value"])}
                  className={cn(
                    "flex h-9 w-full sm:w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  {PERIOD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {period === "personalizado" && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-9 w-full"
                  />
                  <span className="hidden sm:inline text-muted-foreground text-sm">até</span>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-9 w-full"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent title="Filtros de consulta" onClose={() => setFiltersOpen(false)}>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo</label>
                <div className="flex items-center gap-2">
                  <Tags className="h-4 w-4 text-muted-foreground shrink-0" />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Todos</option>
                    {appointmentTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Todos</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {showDoctorFilter && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Profissional</label>
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-muted-foreground shrink-0" />
                  <select
                    value={doctorFilter}
                    onChange={(e) => setDoctorFilter(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Todos</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name || "Sem nome"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dimensão</label>
                <select
                  value={dimensionFilter}
                  onChange={(e) => setDimensionFilter(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Todas</option>
                  {pricingDimensions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor da dimensão</label>
                <select
                  value={dimensionValueFilter}
                  onChange={(e) => setDimensionValueFilter(e.target.value)}
                  disabled={!dimensionFilter}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {!dimensionFilter ? (
                    <option value="">Selecione uma dimensão primeiro</option>
                  ) : (
                    <>
                      <option value="">Todos</option>
                      {dimensionValueOptions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nome}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter("");
                  setTypeFilter("");
                  setDoctorFilter("");
                  setDimensionFilter("");
                  setDimensionValueFilter("");
                }}
              >
                Limpar filtros
              </Button>
              <Button type="button" size="sm" onClick={() => setFiltersOpen(false)}>
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lista de consultas ordenada por data */}
      <div className="space-y-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma consulta encontrada com os filtros aplicados.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/agenda/consulta/${c.id}`}
                  className="grid grid-cols-[auto_1fr_auto] items-start gap-2 py-3 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium tabular-nums shrink-0">
                        {new Date(c.scheduled_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}{" "}
                        {new Date(c.scheduled_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="font-medium truncate">{c.patient.full_name}</span>
                      {c.patient.phone && (
                        <span className="text-sm text-muted-foreground truncate">{c.patient.phone}</span>
                      )}
                    </div>
                    {((c.appointment_type || c.procedure) || (showDoctorFilter && c.doctor?.full_name)) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {(c.appointment_type || c.procedure) && (
                          <span className="shrink-0">
                            {[c.appointment_type?.name, c.procedure?.name].filter(Boolean).join(" · ")}
                          </span>
                        )}
                        {showDoctorFilter && c.doctor?.full_name && (
                          <span>Prof.: {c.doctor.full_name}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Badge className={getStatusBadgeClassName(c.status) + " shrink-0 self-center"}>
                    {STATUS_OPTIONS.find((s) => s.value === c.status)?.label ?? c.status}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
