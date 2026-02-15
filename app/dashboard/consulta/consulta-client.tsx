"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusBadgeClassName } from "../agenda/status-utils";
import type { ConsultaRow } from "./page";

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
  doctors,
  appointmentTypes,
}: {
  consultas: ConsultaRow[];
  doctors: { id: string; full_name: string | null }[];
  appointmentTypes: { id: string; name: string }[];
}) {
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
  ]);

  const showDoctorFilter = doctors.length > 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Consulta</h1>
        <Button asChild>
          <Link href="/dashboard/agenda?new=true">
            <Plus className="h-4 w-4 mr-2" />
            Nova consulta
          </Link>
        </Button>
      </div>

      {/* Linha horizontal de filtros */}
      <div className="border-t border-b border-border py-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Busca por nome / telefone */}
          <div className="flex items-center gap-2 min-w-[200px] flex-1 max-w-sm">
            <span className="text-muted-foreground shrink-0" title="Busca">
              🔍
            </span>
            <Input
              placeholder="Busca por nome ou telefone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Período */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground shrink-0" title="Período">
              📅
            </span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as (typeof PERIOD_OPTIONS)[number]["value"])}
              className={cn(
                "flex h-9 w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {period === "personalizado" && (
              <>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 w-[140px]"
                />
                <span className="text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 w-[140px]"
                />
              </>
            )}
          </div>

          {/* Tipo */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0" title="Tipo">
              🏷
            </span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={cn(
                "flex h-9 w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <option value="">Todos</option>
              {appointmentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0" title="Status">
              📊
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn(
                "flex h-9 w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Profissional (se mais de um) */}
          {showDoctorFilter && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0" title="Profissional">
                👩‍⚕️
              </span>
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className={cn(
                  "flex h-9 w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <option value="">Todos</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name || "Sem nome"}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

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
                  className="flex flex-wrap items-center gap-2 sm:gap-4 py-3 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
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
                  {(c.appointment_type || c.procedure) && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {[c.appointment_type?.name, c.procedure?.name].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {showDoctorFilter && c.doctor?.full_name && (
                    <span className="text-xs text-muted-foreground">Dr(a). {c.doctor.full_name}</span>
                  )}
                  <Badge className={getStatusBadgeClassName(c.status) + " ml-auto shrink-0"}>
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
