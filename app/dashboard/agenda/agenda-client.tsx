"use client";

import { useState, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { createAppointment, updateAppointment, updateUserPreferences } from "./actions";
import { useRouter } from "next/navigation";
import { Plus, CalendarClock, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getStartOfWeek,
  getWeekDates,
  getStartOfMonth,
  getMonthCalendarGrid,
  addDays,
  isSameDay,
  toYMD,
  formatMonthYear,
  formatDayShort,
  getHourSlots,
  getWeekOfMonthLabel,
  iterateDays,
  getWeekStartForPeriod,
  localDateToISO,
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

function todayYMD() {
  return toYMD(new Date());
}

export function AgendaClient({
  appointments,
  patients,
  doctors,
  appointmentTypes,
  initialPreferences,
}: {
  appointments: AppointmentRow[];
  patients: PatientOption[];
  doctors: DoctorOption[];
  appointmentTypes: AppointmentTypeOption[];
  initialPreferences?: {
    viewMode: ViewMode;
    timelineGranularity: TimelineGranularity;
    calendarGranularity: CalendarGranularity;
  };
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialPreferences?.viewMode || "timeline"
  );
  const [timelineGranularity, setTimelineGranularity] =
    useState<TimelineGranularity>(
      initialPreferences?.timelineGranularity || "day"
    );
  const [calendarGranularity, setCalendarGranularity] =
    useState<CalendarGranularity>(
      initialPreferences?.calendarGranularity || "week"
    );
  const [dateInicio, setDateInicio] = useState(() => todayYMD());
  const [dateFim, setDateFim] = useState(() => todayYMD());
  const [draggedAppointment, setDraggedAppointment] =
    useState<AppointmentRow | null>(null);
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    appointmentTypeId: "",
    date: todayYMD(),
    time: "09:00",
    notes: "",
  });

  const today = useMemo(() => new Date(), []);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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
      date: todayYMD(),
      time: "09:00",
      notes: "",
    });
    router.refresh();
    setLoading(false);
  }

  const start = new Date(dateInicio + "T12:00:00");
  const end = new Date(dateFim + "T12:00:00");
  // Garantir início <= fim
  const [rangeStart, rangeEnd] =
    start <= end ? [start, end] : [end, start];
  const calendarDate = rangeStart;

  // Filtrar appointments pelo período apenas para visualização
  // Mas manter todos os appointments disponíveis para drag and drop
  const appointmentsInPeriod = useMemo(() => {
    const ymdStart = toYMD(rangeStart);
    const ymdEnd = toYMD(rangeEnd);
    return appointments.filter((a) => {
      const d = a.scheduled_at.slice(0, 10);
      return d >= ymdStart && d <= ymdEnd;
    });
  }, [appointments, rangeStart, rangeEnd]);

  // Para drag and drop, usar todos os appointments (não apenas do período)
  const allAppointmentsForDrag = appointments;

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !draggedAppointment) {
      setDraggedAppointment(null);
      return;
    }

    // over.id pode ser o ID do appointment (se drop no mesmo dia) ou o dayId (se drop em outro dia)
    const targetId = over.id as string;
    const activeId = active.id as string;

    // Se drop no mesmo item, não faz nada
    if (targetId === activeId) {
      setDraggedAppointment(null);
      return;
    }

    // Verificar se é um dayId (YYYY-MM-DD) ou um appointment ID
    let targetDate: string | null = null;
    if (targetId.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // É um dayId
      targetDate = targetId;
    } else {
      // É outro appointment - pegar o dayId do data
      // Buscar em todos os appointments
      const targetAppointment = allAppointmentsForDrag.find((a) => a.id === targetId);
      if (targetAppointment) {
        targetDate = targetAppointment.scheduled_at.slice(0, 10);
      }
    }

    if (!targetDate) {
      setDraggedAppointment(null);
      return;
    }

    // Usar data local para evitar problemas de timezone
    const oldDate = new Date(draggedAppointment.scheduled_at);
    // Criar data local a partir do targetDate (YYYY-MM-DD)
    const [year, month, day] = targetDate.split("-").map(Number);
    const oldHour = oldDate.getHours();
    const oldMinute = oldDate.getMinutes();

    // Só reagendar se mudou de dia
    if (targetDate !== draggedAppointment.scheduled_at.slice(0, 10)) {
      // Converter para ISO string preservando a data local (evita problemas de timezone)
      const isoString = localDateToISO(year, month, day, oldHour, oldMinute);
      const res = await updateAppointment(draggedAppointment.id, {
        scheduled_at: isoString,
      });

      if (!res.error) {
        // Usar router.refresh() para atualizar dados sem perder estado
        router.refresh();
      } else {
        alert(`Erro ao reagendar: ${res.error}`);
      }
    }
    setDraggedAppointment(null);
  }

  function handleDragStart(event: DragStartEvent) {
    const appointmentId = event.active.id as string;
    // Buscar em todos os appointments, não apenas no período
    const appointment = allAppointmentsForDrag.find((a) => a.id === appointmentId);
    setDraggedAppointment(appointment || null);
  }

  return (
    <div className="space-y-6">
      {/* Toolbar: modo, granularidade (calendário), período, nova consulta */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <select
              value={viewMode}
              onChange={async (e) => {
                const newMode = e.target.value as ViewMode;
                setViewMode(newMode);
                await updateUserPreferences({ agenda_view_mode: newMode });
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="timeline">Timeline</option>
              <option value="calendar">Calendário</option>
            </select>
            {viewMode === "timeline" && (
              <select
                value={timelineGranularity}
                onChange={async (e) => {
                  const newGran = e.target.value as TimelineGranularity;
                  setTimelineGranularity(newGran);
                  await updateUserPreferences({
                    agenda_timeline_granularity: newGran,
                  });
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="day">Dia</option>
                <option value="week">Semana</option>
                <option value="month">Mês</option>
              </select>
            )}
            {viewMode === "calendar" && (
              <select
                value={calendarGranularity}
                onChange={async (e) => {
                  const newGran = e.target.value as CalendarGranularity;
                  setCalendarGranularity(newGran);
                  await updateUserPreferences({
                    agenda_calendar_granularity: newGran,
                  });
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="week">Semana</option>
                <option value="month">Mês</option>
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="date_inicio" className="text-muted-foreground text-sm">
              De
            </Label>
            <Input
              id="date_inicio"
              type="date"
              value={dateInicio}
              onChange={(e) => setDateInicio(e.target.value)}
              className="w-40"
            />
            <Label htmlFor="date_fim" className="text-muted-foreground text-sm">
              até
            </Label>
            <Input
              id="date_fim"
              type="date"
              value={dateFim}
              onChange={(e) => setDateFim(e.target.value)}
              className="w-40"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const t = todayYMD();
                setDateInicio(t);
                setDateFim(t);
              }}
            >
              Hoje
            </Button>
          </div>

          <Button
            className="ml-auto"
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      {viewMode === "timeline" && (
        <TimelineListView
          appointments={allAppointmentsForDrag}
          dateInicio={rangeStart}
          dateFim={rangeEnd}
          today={today}
          granularity={timelineGranularity}
        />
      )}
      {viewMode === "calendar" && calendarGranularity === "week" && (
        <CalendarWeekView
          appointments={allAppointmentsForDrag}
          currentDate={calendarDate}
          today={today}
        />
      )}
      {viewMode === "calendar" && calendarGranularity === "month" && (
        <CalendarMonthView
          appointments={allAppointmentsForDrag}
          currentDate={calendarDate}
          today={today}
          onSelectDay={(day) => {
            setDateInicio(toYMD(day));
            setDateFim(toYMD(day));
            setViewMode("timeline");
          }}
        />
      )}
        <DragOverlay>
          {draggedAppointment ? (
            <div className="opacity-50">
              <AppointmentListItem appointment={draggedAppointment} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/** Timeline com granularidade: Dia (1 dia) | Semana (segunda 8, terça 9...) | Mês (janeiro, fev) */
function TimelineListView({
  appointments,
  dateInicio,
  dateFim,
  today,
  granularity,
}: {
  appointments: AppointmentRow[];
  dateInicio: Date;
  dateFim: Date;
  today: Date;
  granularity: TimelineGranularity;
}) {
  // Usar todos os appointments para construir byDay (não apenas do período)
  // Isso permite drag and drop mesmo quando appointments estão fora do período visualizado
  const byDay = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    appointments.forEach((a) => {
      const key = a.scheduled_at.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    Object.keys(map).forEach((k) => {
      map[k].sort(
        (x, y) =>
          new Date(x.scheduled_at).getTime() - new Date(y.scheduled_at).getTime()
      );
    });
    return map;
  }, [appointments]);

  // Calcular dados para semana e mês (sempre, para não violar regras dos hooks)
  const weekStart = useMemo(() => getWeekStartForPeriod(dateInicio), [dateInicio]);
  const weekDays = useMemo(
    () => iterateDays(weekStart, dateFim),
    [weekStart, dateFim]
  );

  const monthStart = useMemo(() => getWeekStartForPeriod(dateInicio), [dateInicio]);
  const monthDays = useMemo(
    () => iterateDays(monthStart, dateFim),
    [monthStart, dateFim]
  );
  const byMonthAdjusted = useMemo(() => {
    const map: Record<string, Date[]> = {};
    monthDays.forEach((d) => {
      const mKey = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map[mKey]) map[mKey] = [];
      map[mKey].push(d);
    });
    return map;
  }, [monthDays]);
  const monthOrderAdjusted = Object.keys(byMonthAdjusted).sort();

  // Dia: só 1 dia (usa dateInicio)
  if (granularity === "day") {
    const d = dateInicio;
    const dayId = toYMD(d);
    const list = byDay[dayId] ?? [];
    return (
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground capitalize">
            {d.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </CardHeader>
        <CardContent>
          <DroppableDay dayId={dayId} className="min-h-[100px]">
            {list.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">
                Nenhuma consulta nesta data.
              </div>
            ) : (
              <SortableContext
                items={list.map((a) => a.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="divide-y divide-border">
                  {list.map((a) => (
                    <DraggableAppointmentItem
                      key={a.id}
                      appointment={a}
                      dayId={dayId}
                    />
                  ))}
                </ul>
              </SortableContext>
            )}
          </DroppableDay>
        </CardContent>
      </Card>
    );
  }

  // Semana: cada dia no período como "Segunda (8)", "Terça (9)", "Segunda (15)"...
  // Sempre começa na segunda anterior ao início
  if (granularity === "week") {
    if (weekDays.length === 0) {
      return (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              Período inválido. Ajuste as datas.
            </p>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            Arraste consultas para reagendar. Clique para ver detalhes.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4 list-none p-0 m-0">
            {weekDays.map((d) => {
              const dayLabel = `${formatDayShort(d)} (${d.getDate()})`;
              const list = byDay[toYMD(d)] ?? [];
              const dayId = toYMD(d);
              return (
                <li key={dayId}>
                  <DroppableDay
                    dayId={dayId}
                    className={cn(
                      "rounded px-2 py-2 min-h-[60px]",
                      isSameDay(d, today) && "bg-primary/5"
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-medium mb-1",
                        isSameDay(d, today) && "text-primary"
                      )}
                    >
                      {dayLabel}
                    </p>
                    {list.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-2">
                        Nenhuma consulta
                      </p>
                    ) : (
                      <SortableContext
                        items={list.map((a) => a.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="divide-y divide-border">
                          {list.map((a) => (
                            <DraggableAppointmentItem
                              key={a.id}
                              appointment={a}
                              dayId={dayId}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    )}
                  </DroppableDay>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    );
  }

  // Mês: Janeiro, Fevereiro... no período
  // Sempre começa na segunda anterior ao início (similar à semana)
  if (granularity === "month") {
    if (monthOrderAdjusted.length === 0) {
      return (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              Selecione o período (data inicial e final) para ver as consultas.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground">
          Meses no período. Clique em uma consulta para abrir.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-6 list-none p-0 m-0">
          {monthOrderAdjusted.map((mKey) => {
            const [y, m] = mKey.split("-").map(Number);
            const monthDate = new Date(y, m, 1);
            const monthLabel = formatMonthYear(monthDate);
            const monthDaysList = byMonthAdjusted[mKey];
            return (
              <li key={mKey} className="space-y-2">
                <h3 className="font-semibold text-base capitalize">
                  {monthLabel}
                </h3>
                <ul className="space-y-2 list-none pl-4 border-l-2 border-muted">
                  {monthDaysList.map((d) => {
                    const dayLabel = `${formatDayShort(d)} (${d.getDate()})`;
                    const list = byDay[toYMD(d)] ?? [];
                    const dayId = toYMD(d);
                    return (
                      <li key={dayId}>
                        <DroppableDay
                          dayId={dayId}
                          className={cn(
                            "rounded px-2 py-1 min-h-[60px]",
                            isSameDay(d, today) && "bg-primary/5"
                          )}
                        >
                          <p
                            className={cn(
                              "text-sm font-medium",
                              isSameDay(d, today) && "text-primary"
                            )}
                          >
                            {dayLabel}
                          </p>
                          {list.length === 0 ? (
                            <p className="text-xs text-muted-foreground pl-2">
                              Nenhuma consulta
                            </p>
                          ) : (
                            <SortableContext
                              items={list.map((a) => a.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <ul className="divide-y divide-border mt-1">
                                {list.map((a) => (
                                  <DraggableAppointmentItem
                                    key={a.id}
                                    appointment={a}
                                    dayId={dayId}
                                  />
                                ))}
                              </ul>
                            </SortableContext>
                          )}
                        </DroppableDay>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
  }

  // Se nenhuma granularidade foi selecionada (não deveria acontecer)
  return null;
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
  // Usar todos os appointments, não apenas do período filtrado
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
                {weekDays.map((d) => {
                  const dayId = toYMD(d);
                  const hourAppointments = byDayHour[dayId]?.[hour] ?? [];
                  return (
                    <DroppableDay
                      key={`${dayId}-${hour}`}
                      dayId={dayId}
                      className={cn(
                        "p-1 border-r border-border last:border-r-0 min-h-[48px]",
                        isSameDay(d, today) && "bg-primary/5"
                      )}
                    >
                      {hourAppointments.length > 0 ? (
                        <SortableContext
                          items={hourAppointments.map((a) => a.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {hourAppointments.map((a) => (
                            <DraggableAppointmentItem
                              key={a.id}
                              appointment={a}
                              dayId={dayId}
                              compact
                            />
                          ))}
                        </SortableContext>
                      ) : (
                        // Célula vazia também é drop zone
                        <div className="min-h-[20px]" />
                      )}
                    </DroppableDay>
                  );
                })}
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
  // Usar todos os appointments, não apenas do período filtrado
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
                    <DroppableDay
                      dayId={toYMD(day)}
                      className="mt-1 space-y-1 flex-1 overflow-hidden min-h-[60px]"
                    >
                      {(byDay[toYMD(day)] ?? []).length > 0 ? (
                        <SortableContext
                          items={(byDay[toYMD(day)] ?? []).map((ap) => ap.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {(byDay[toYMD(day)] ?? []).slice(0, 4).map((a) => {
                            const dayId = toYMD(day);
                            return (
                              <div
                                key={a.id}
                                className="rounded px-1.5 py-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 mb-0.5"
                              >
                                <DraggableAppointmentItem
                                  appointment={a}
                                  dayId={dayId}
                                  compact
                                />
                              </div>
                            );
                          })}
                        </SortableContext>
                      ) : null}
                      {(byDay[toYMD(day)] ?? []).length > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{(byDay[toYMD(day)] ?? []).length - 4} mais
                        </span>
                      )}
                    </DroppableDay>
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

function DroppableDay({
  dayId,
  children,
  className,
}: {
  dayId: string;
  children: ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dayId,
    data: {
      type: "day",
      dayId,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isOver && "bg-primary/10 ring-2 ring-primary ring-offset-2"
      )}
    >
      {children}
    </div>
  );
}

function DraggableAppointmentItem({
  appointment,
  dayId,
  compact,
}: {
  appointment: AppointmentRow;
  dayId: string;
  compact?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: appointment.id,
    data: {
      type: "appointment",
      appointment,
      dayId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-1"
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          type="button"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <Link
          href={`/dashboard/agenda/consulta/${appointment.id}`}
          className="flex-1 truncate text-xs"
          title={`${new Date(appointment.scheduled_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })} ${appointment.patient.full_name}`}
        >
          {new Date(appointment.scheduled_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          {appointment.patient.full_name}
        </Link>
      </div>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="py-3 first:pt-0"
    >
      <div className="flex items-center gap-2 hover:bg-muted/50 -mx-2 px-2 py-1 rounded group">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          type="button"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Link
          href={`/dashboard/agenda/consulta/${appointment.id}`}
          className="flex-1 flex items-center justify-between gap-4 min-w-0"
        >
          <AppointmentContent appointment={appointment} />
        </Link>
      </div>
    </li>
  );
}

function AppointmentContent({ appointment: a }: { appointment: AppointmentRow }) {
  const time = new Date(a.scheduled_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const pendingForms =
    a.form_instances?.filter((f) => f.status === "pendente").length ?? 0;

  return (
    <>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium tabular-nums shrink-0">{time}</span>
        <span className="truncate">{a.patient.full_name}</span>
        {a.appointment_type && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
            · {a.appointment_type.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {pendingForms > 0 && (
          <Badge variant="secondary" className="text-xs">
            {pendingForms} form.
          </Badge>
        )}
        <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"} className="text-xs">
          {STATUS_LABEL[a.status] ?? a.status}
        </Badge>
      </div>
    </>
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
    <>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {!compact && (
          <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="font-medium tabular-nums shrink-0">{time}</span>
        <span className="truncate">{a.patient.full_name}</span>
        {a.appointment_type && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
            · {a.appointment_type.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {pendingForms > 0 && (
          <Badge variant="secondary" className="text-xs">
            {pendingForms} form.
          </Badge>
        )}
        <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"} className="text-xs">
          {STATUS_LABEL[a.status] ?? a.status}
        </Badge>
      </div>
    </>
  );

  if (compact) {
    return (
      <Link
        href={`/dashboard/agenda/consulta/${a.id}`}
        className="block text-xs rounded border border-border bg-card px-1.5 py-1 hover:bg-muted/50 mb-0.5 flex items-center justify-between gap-2"
      >
        {content}
      </Link>
    );
  }

  return (
    <li className="py-3 first:pt-0">
      <Link
        href={`/dashboard/agenda/consulta/${a.id}`}
        className="flex items-center justify-between gap-4 hover:bg-muted/50 -mx-2 px-2 py-1 rounded min-w-0"
      >
        {content}
      </Link>
    </li>
  );
}
