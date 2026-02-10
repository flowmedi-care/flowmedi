"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { createAppointment } from "./actions";
import {
  Plus,
  CalendarClock,
  LayoutList,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getStartOfWeek,
  getWeekDates,
  getStartOfMonth,
  getMonthCalendarGrid,
  addDays,
  addWeeks,
  addMonths,
  isSameDay,
  toYMD,
  formatWeekRange,
  formatMonthYear,
  formatDayShort,
  getHourSlots,
} from "./agenda-date-utils";

export type AppointmentRow = {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  patient: { id: string; full_name: string };
  doctor: { id: string; full_name: string | null };
  appointment_type: { id: string; name: string } | null;
  form_instances?: { id: string; status: string }[];
};

export type PatientOption = { id: string; full_name: string };
export type DoctorOption = { id: string; full_name: string | null };
export type AppointmentTypeOption = { id: string; name: string };

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  falta: "Falta",
  cancelada: "Cancelada",
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "success" | "warning" | "destructive"
> = {
  agendada: "outline",
  confirmada: "default",
  realizada: "success",
  falta: "warning",
  cancelada: "destructive",
};

type ViewMode = "timeline" | "calendar";
type TimelineGranularity = "day" | "week" | "month";
type CalendarGranularity = "week" | "month";

export function AgendaClient({
  appointments,
  patients,
  doctors,
  appointmentTypes,
}: {
  appointments: AppointmentRow[];
  patients: PatientOption[];
  doctors: DoctorOption[];
  appointmentTypes: AppointmentTypeOption[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [timelineGranularity, setTimelineGranularity] =
    useState<TimelineGranularity>("day");
  const [calendarGranularity, setCalendarGranularity] =
    useState<CalendarGranularity>("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    appointmentTypeId: "",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    notes: "",
  });

  const today = useMemo(() => new Date(), []);

  const periodLabel =
    viewMode === "timeline"
      ? timelineGranularity === "day"
        ? currentDate.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : timelineGranularity === "week"
          ? formatWeekRange(getStartOfWeek(currentDate))
          : formatMonthYear(currentDate)
      : calendarGranularity === "week"
        ? formatWeekRange(getStartOfWeek(currentDate))
        : formatMonthYear(currentDate);

  function goPrev() {
    if (viewMode === "timeline") {
      if (timelineGranularity === "day") setCurrentDate((d) => addDays(d, -1));
      else if (timelineGranularity === "week")
        setCurrentDate((d) => addWeeks(d, -1));
      else setCurrentDate((d) => addMonths(d, -1));
    } else {
      if (calendarGranularity === "week")
        setCurrentDate((d) => addWeeks(d, -1));
      else setCurrentDate((d) => addMonths(d, -1));
    }
  }

  function goNext() {
    if (viewMode === "timeline") {
      if (timelineGranularity === "day") setCurrentDate((d) => addDays(d, 1));
      else if (timelineGranularity === "week")
        setCurrentDate((d) => addWeeks(d, 1));
      else setCurrentDate((d) => addMonths(d, 1));
    } else {
      if (calendarGranularity === "week")
        setCurrentDate((d) => addWeeks(d, 1));
      else setCurrentDate((d) => addMonths(d, 1));
    }
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const localDate = new Date(`${form.date}T${form.time}:00`);
    const scheduledAt = localDate.toISOString();
    const res = await createAppointment(
      form.patientId,
      form.doctorId,
      form.appointmentTypeId || null,
      scheduledAt,
      form.notes || null
    );
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setShowForm(false);
    setForm({
      patientId: "",
      doctorId: "",
      appointmentTypeId: "",
      date: new Date().toISOString().slice(0, 10),
      time: "09:00",
      notes: "",
    });
    window.location.reload();
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Toolbar: modo + granularidade + navegação */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground mr-1">
            Visualização:
          </span>
          <div className="flex rounded-lg border border-input bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                viewMode === "timeline"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="h-4 w-4" />
              Timeline
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                viewMode === "calendar"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays className="h-4 w-4" />
              Calendário
            </button>
          </div>

          {viewMode === "timeline" && (
            <div className="flex rounded-lg border border-input bg-muted/30 p-0.5">
              {(["day", "week", "month"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setTimelineGranularity(g)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                    timelineGranularity === g
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {g === "day" ? "Dia" : g === "week" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
          )}

          {viewMode === "calendar" && (
            <div className="flex rounded-lg border border-input bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setCalendarGranularity("week")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  calendarGranularity === "week"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => setCalendarGranularity("month")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  calendarGranularity === "month"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Mês
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 ml-auto">
            <Button variant="outline" size="icon" onClick={goPrev} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToday}
              className="capitalize"
            >
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={goNext} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="min-w-[180px] text-center text-sm font-medium text-foreground capitalize">
              {periodLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 justify-between">
          {viewMode === "timeline" && timelineGranularity === "day" && (
            <div className="flex items-center gap-2">
              <Label htmlFor="date_filter" className="whitespace-nowrap">
                Data
              </Label>
              <Input
                id="date_filter"
                type="date"
                value={toYMD(currentDate)}
                onChange={(e) => setCurrentDate(new Date(e.target.value + "T12:00:00"))}
                className="w-40"
              />
            </div>
          )}
          <Button
            onClick={() => {
              setShowForm(true);
              if (doctors.length === 1) {
                setForm((f) => ({ ...f, doctorId: doctors[0].id }));
              }
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova consulta
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="font-semibold">Agendar consulta</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                  {error}
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
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo da visão */}
      {viewMode === "timeline" && timelineGranularity === "day" && (
        <TimelineDayView
          appointments={appointments}
          currentDate={currentDate}
          today={today}
        />
      )}
      {viewMode === "timeline" && timelineGranularity === "week" && (
        <TimelineWeekView
          appointments={appointments}
          currentDate={currentDate}
          today={today}
        />
      )}
      {viewMode === "timeline" && timelineGranularity === "month" && (
        <TimelineMonthView
          appointments={appointments}
          currentDate={currentDate}
          today={today}
          onSelectDay={(day) => {
            setCurrentDate(day);
            setTimelineGranularity("day");
          }}
        />
      )}
      {viewMode === "calendar" && calendarGranularity === "week" && (
        <CalendarWeekView
          appointments={appointments}
          currentDate={currentDate}
          today={today}
        />
      )}
      {viewMode === "calendar" && calendarGranularity === "month" && (
        <CalendarMonthView
          appointments={appointments}
          currentDate={currentDate}
          today={today}
          onSelectDay={(day) => {
            setCurrentDate(day);
            setViewMode("timeline");
            setTimelineGranularity("day");
          }}
        />
      )}
    </div>
  );
}

function TimelineDayView({
  appointments,
  currentDate,
  today,
}: {
  appointments: AppointmentRow[];
  currentDate: Date;
  today: Date;
}) {
  const dayStr = toYMD(currentDate);
  const filtered = appointments
    .filter((a) => a.scheduled_at.slice(0, 10) === dayStr)
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground">
          Consultas do dia. Clique para ver detalhes e formulários.
        </p>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nenhuma consulta nesta data.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((a) => (
              <AppointmentListItem key={a.id} appointment={a} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineWeekView({
  appointments,
  currentDate,
  today,
}: {
  appointments: AppointmentRow[];
  currentDate: Date;
  today: Date;
}) {
  const weekDays = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const byDay = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    weekDays.forEach((d) => {
      map[toYMD(d)] = [];
    });
    appointments.forEach((a) => {
      const key = a.scheduled_at.slice(0, 10);
      if (map[key]) map[key].push(a);
    });
    Object.keys(map).forEach((k) => {
      map[k].sort(
        (x, y) =>
          new Date(x.scheduled_at).getTime() - new Date(y.scheduled_at).getTime()
      );
    });
    return map;
  }, [appointments, weekDays]);

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground">
          Consultas por dia da semana. Clique em uma consulta para abrir.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((d) => (
            <div
              key={toYMD(d)}
              className={cn(
                "p-2 border-r border-border last:border-r-0 text-center",
                isSameDay(d, today) && "bg-primary/5"
              )}
            >
              <div className="text-xs font-medium text-muted-foreground uppercase">
                {formatDayShort(d)}
              </div>
              <div
                className={cn(
                  "text-lg font-semibold",
                  isSameDay(d, today) && "text-primary"
                )}
              >
                {d.getDate()}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-[200px]">
          {weekDays.map((d) => (
            <div
              key={toYMD(d)}
              className={cn(
                "p-2 border-r border-border last:border-r-0 min-h-[120px]",
                isSameDay(d, today) && "bg-primary/5"
              )}
            >
              {(byDay[toYMD(d)] ?? []).map((a) => (
                <AppointmentListItem key={a.id} appointment={a} compact />
              ))}
              {(byDay[toYMD(d)] ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Sem consultas</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineMonthView({
  appointments,
  currentDate,
  today,
  onSelectDay,
}: {
  appointments: AppointmentRow[];
  currentDate: Date;
  today: Date;
  onSelectDay: (d: Date) => void;
}) {
  const grid = getMonthCalendarGrid(currentDate);
  const byDay = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    appointments.forEach((a) => {
      const key = a.scheduled_at.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [appointments]);

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground">
          Clique em um dia para ver as consultas ou mudar para a visão Dia.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b border-border">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => (
            <div
              key={label}
              className="p-2 border-r border-border last:border-r-0 text-center text-xs font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>
        {grid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day, di) => (
              <div
                key={di}
                className={cn(
                  "min-h-[88px] p-1.5 border-r border-border last:border-r-0",
                  !day && "bg-muted/30",
                  day && isSameDay(day, today) && "bg-primary/5"
                )}
              >
                {day ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelectDay(day)}
                      className={cn(
                        "w-7 h-7 rounded-full text-sm font-medium flex items-center justify-center hover:bg-muted",
                        isSameDay(day, today) && "bg-primary text-primary-foreground"
                      )}
                    >
                      {day.getDate()}
                    </button>
                    <div className="mt-0.5 space-y-0.5">
                      {(byDay[toYMD(day)] ?? []).slice(0, 3).map((a) => (
                        <Link
                          key={a.id}
                          href={`/dashboard/agenda/consulta/${a.id}`}
                          className="block text-xs truncate rounded px-1 py-0.5 bg-muted hover:bg-muted/80"
                          title={`${new Date(a.scheduled_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })} ${a.patient.full_name}`}
                        >
                          {new Date(a.scheduled_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          {a.patient.full_name}
                        </Link>
                      ))}
                      {(byDay[toYMD(day)] ?? []).length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{(byDay[toYMD(day)] ?? []).length - 3}
                        </span>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const HOUR_SLOTS = getHourSlots(7, 20);

function CalendarWeekView({
  appointments,
  currentDate,
  today,
}: {
  appointments: AppointmentRow[];
  currentDate: Date;
  today: Date;
}) {
  const weekDays = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const byDayHour = useMemo(() => {
    const map: Record<string, Record<number, AppointmentRow[]>> = {};
    weekDays.forEach((d) => {
      map[toYMD(d)] = {};
      HOUR_SLOTS.forEach((h) => {
        map[toYMD(d)][h] = [];
      });
    });
    appointments.forEach((a) => {
      const key = a.scheduled_at.slice(0, 10);
      const hour = new Date(a.scheduled_at).getHours();
      if (map[key] && map[key][hour] !== undefined) map[key][hour].push(a);
    });
    Object.keys(map).forEach((dayKey) => {
      Object.keys(map[dayKey]).forEach((h) => {
        const hour = Number(h);
        map[dayKey][hour].sort(
          (x, y) =>
            new Date(x.scheduled_at).getTime() - new Date(y.scheduled_at).getTime()
        );
      });
    });
    return map;
  }, [appointments, weekDays]);

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground">
          Grade semanal por horário. Clique em uma consulta para abrir.
        </p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[56px_1fr] border-b border-border">
            <div className="border-r border-border bg-muted/30" />
            <div className="grid grid-cols-7 border-border">
              {weekDays.map((d) => (
                <div
                  key={toYMD(d)}
                  className={cn(
                    "p-2 border-r border-border last:border-r-0 text-center",
                    isSameDay(d, today) && "bg-primary/5"
                  )}
                >
                  <div className="text-xs font-medium text-muted-foreground uppercase">
                    {formatDayShort(d)}
                  </div>
                  <div
                    className={cn(
                      "text-sm font-semibold",
                      isSameDay(d, today) && "text-primary"
                    )}
                  >
                    {d.getDate()}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {HOUR_SLOTS.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[56px_1fr] border-b border-border min-h-[48px]"
            >
              <div className="border-r border-border bg-muted/30 py-1 pr-2 text-right text-xs text-muted-foreground">
                {hour.toString().padStart(2, "0")}:00
              </div>
              <div className="grid grid-cols-7 border-border">
                {weekDays.map((d) => (
                  <div
                    key={toYMD(d)}
                    className={cn(
                      "p-1 border-r border-border last:border-r-0",
                      isSameDay(d, today) && "bg-primary/5"
                    )}
                  >
                    {(byDayHour[toYMD(d)]?.[hour] ?? []).map((a) => (
                      <AppointmentListItem key={a.id} appointment={a} compact />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarMonthView({
  appointments,
  currentDate,
  today,
  onSelectDay,
}: {
  appointments: AppointmentRow[];
  currentDate: Date;
  today: Date;
  onSelectDay: (d: Date) => void;
}) {
  const grid = getMonthCalendarGrid(currentDate);
  const byDay = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    appointments.forEach((a) => {
      const key = a.scheduled_at.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [appointments]);

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground">
          Clique em um dia para ver as consultas.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b border-border">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => (
            <div
              key={label}
              className="p-2 border-r border-border last:border-r-0 text-center text-xs font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>
        {grid.map((week, wi) => (
          <div
            key={wi}
            className="grid grid-cols-7 border-b border-border last:border-b-0"
          >
            {week.map((day, di) => (
              <div
                key={di}
                className={cn(
                  "min-h-[100px] p-1.5 border-r border-border last:border-r-0 flex flex-col",
                  !day && "bg-muted/30",
                  day && isSameDay(day, today) && "bg-primary/5"
                )}
              >
                {day ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelectDay(day)}
                      className={cn(
                        "w-7 h-7 rounded-full text-sm font-medium flex items-center justify-center hover:bg-muted self-start",
                        isSameDay(day, today) &&
                          "bg-primary text-primary-foreground"
                      )}
                    >
                      {day.getDate()}
                    </button>
                    <div className="mt-1 space-y-1 flex-1 overflow-hidden">
                      {(byDay[toYMD(day)] ?? []).slice(0, 4).map((a) => (
                        <Link
                          key={a.id}
                          href={`/dashboard/agenda/consulta/${a.id}`}
                          className="block text-xs truncate rounded px-1.5 py-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20"
                          title={`${new Date(a.scheduled_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })} ${a.patient.full_name}`}
                        >
                          {new Date(a.scheduled_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          {a.patient.full_name}
                        </Link>
                      ))}
                      {(byDay[toYMD(day)] ?? []).length > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{(byDay[toYMD(day)] ?? []).length - 4} mais
                        </span>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AppointmentListItem({
  appointment: a,
  compact,
}: {
  appointment: AppointmentRow;
  compact?: boolean;
}) {
  const time = new Date(a.scheduled_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const pendingForms =
    a.form_instances?.filter((f) => f.status === "pendente").length ?? 0;

  const content = (
    <div className="flex flex-wrap items-center justify-between gap-1">
      <div className="flex items-center gap-1.5 min-w-0">
        {!compact && (
          <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="font-medium tabular-nums shrink-0">{time}</span>
        <span className="truncate">{a.patient.full_name}</span>
        {a.appointment_type && (
          <span className="text-xs text-muted-foreground shrink-0">
            · {a.appointment_type.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {pendingForms > 0 && (
          <Badge variant="secondary" className="text-xs">
            {pendingForms} form.
          </Badge>
        )}
        <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"} className="text-xs">
          {STATUS_LABEL[a.status] ?? a.status}
        </Badge>
      </div>
    </div>
  );

  if (compact) {
    return (
      <Link
        href={`/dashboard/agenda/consulta/${a.id}`}
        className="block text-xs rounded border border-border bg-card px-1.5 py-1 hover:bg-muted/50 mb-0.5"
      >
        {content}
      </Link>
    );
  }

  return (
    <li className="py-3 first:pt-0">
      <Link
        href={`/dashboard/agenda/consulta/${a.id}`}
        className="flex flex-wrap items-center justify-between gap-2 hover:bg-muted/50 -mx-2 px-2 py-1 rounded"
      >
        {content}
      </Link>
    </li>
  );
}
