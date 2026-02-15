"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusBadgeClassName } from "../agenda/status-utils";
import { createAppointment } from "../agenda/actions";
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
}: {
  consultas: ConsultaRow[];
  patients: { id: string; full_name: string }[];
  doctors: { id: string; full_name: string | null }[];
  appointmentTypes: { id: string; name: string }[];
  procedures: { id: string; name: string; recommendations: string | null }[];
  formTemplates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showNewForm, setShowNewForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    appointmentTypeId: "",
    procedureId: "",
    linkedFormTemplateIds: [] as string[],
    date: todayYMD(),
    time: "09:00",
    notes: "",
    recommendations: "",
    requiresFasting: false,
    requiresMedicationStop: false,
    specialInstructions: "",
    preparationNotes: "",
  });

  useEffect(() => {
    const patientId = searchParams.get("patientId") ?? "";
    const doctorId = searchParams.get("doctorId") ?? "";
    if (patientId || doctorId) {
      setShowNewForm(true);
      setForm((f) => ({
        ...f,
        ...(patientId && { patientId }),
        ...(doctorId && { doctorId }),
      }));
    }
  }, [searchParams]);

  async function handleSubmitNew(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    const localDate = new Date(`${form.date}T${form.time}:00`);
    const scheduledAt = localDate.toISOString();
    const res = await createAppointment(
      form.patientId,
      form.doctorId,
      form.appointmentTypeId || null,
      scheduledAt,
      form.notes || null,
      form.recommendations || null,
      form.procedureId || null,
      form.requiresFasting,
      form.requiresMedicationStop,
      form.specialInstructions || null,
      form.preparationNotes || null,
      form.linkedFormTemplateIds.length ? form.linkedFormTemplateIds : undefined
    );
    setLoading(false);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    setShowNewForm(false);
    setForm({
      patientId: "",
      doctorId: "",
      appointmentTypeId: "",
      procedureId: "",
      linkedFormTemplateIds: [],
      date: todayYMD(),
      time: "09:00",
      notes: "",
      recommendations: "",
      requiresFasting: false,
      requiresMedicationStop: false,
      specialInstructions: "",
      preparationNotes: "",
    });
    router.refresh();
  }

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
        <Button type="button" onClick={() => setShowNewForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova consulta
        </Button>
      </div>

      {showNewForm && (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="font-semibold">Nova consulta</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitNew} className="space-y-4">
              {formError && (
                <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                  {formError}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Paciente *</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.patientId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, patientId: e.target.value }))
                    }
                    required
                  >
                    <option value="">Selecione</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Médico *</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.doctorId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, doctorId: e.target.value }))
                    }
                    required
                  >
                    <option value="">Selecione</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name || d.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de consulta</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.appointmentTypeId}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        appointmentTypeId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Nenhum</option>
                    {appointmentTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Procedimento</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.procedureId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const proc = procedures.find((p) => p.id === id);
                      setForm((f) => ({
                        ...f,
                        procedureId: id,
                        recommendations: proc?.recommendations ?? f.recommendations,
                      }));
                    }}
                  >
                    <option value="">Nenhum</option>
                    {procedures.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                {formTemplates.length > 0 && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Vincular formulário(s)</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      value=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (!id) return;
                        if (form.linkedFormTemplateIds.includes(id)) return;
                        setForm((f) => ({
                          ...f,
                          linkedFormTemplateIds: [...f.linkedFormTemplateIds, id],
                        }));
                        e.target.value = "";
                      }}
                    >
                      <option value="">Selecione para adicionar</option>
                      {formTemplates
                        .filter((ft) => !form.linkedFormTemplateIds.includes(ft.id))
                        .map((ft) => (
                          <option key={ft.id} value={ft.id}>
                            {ft.name}
                          </option>
                        ))}
                    </select>
                    {form.linkedFormTemplateIds.length > 0 && (
                      <ul className="flex flex-wrap gap-2 mt-1">
                        {form.linkedFormTemplateIds.map((id) => {
                          const ft = formTemplates.find((t) => t.id === id);
                          return (
                            <li
                              key={id}
                              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-sm"
                            >
                              {ft?.name ?? id}
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    linkedFormTemplateIds: f.linkedFormTemplateIds.filter((x) => x !== id),
                                  }))
                                }
                                className="text-muted-foreground hover:text-foreground"
                              >
                                ×
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                <div className="space-y-2 sm:col-span-2">
                  <Label>Data e hora *</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, date: e.target.value }))
                      }
                      required
                    />
                    <Input
                      type="time"
                      value={form.time}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, time: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Recomendações</Label>
                <Textarea
                  value={form.recommendations}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, recommendations: e.target.value }))
                  }
                  placeholder="Opcional"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                  placeholder="Opcional"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Agendando…" : "Agendar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNewForm(false);
                    setFormError(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
