"use client";

import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { createAppointment, updateAppointment, updateUserPreferences, getPublicFormTemplatesForPatient } from "./actions";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Plus, CalendarClock, GripVertical, ChevronDown } from "lucide-react";
import { AgendaFilters } from "./agenda-filters";
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
  pointerWithin,
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
  getEndOfMonth,
  getEndOfWeek,
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
import { getStatusBackgroundColor, getStatusTextColor } from "./status-utils";

export type AppointmentRow = {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  patient: { id: string; full_name: string };
  doctor: { id: string; full_name: string | null };
  appointment_type: { id: string; name: string } | null;
  procedure: { id: string; name: string } | null;
  form_instances?: { id: string; status: string }[];
};

export type PatientOption = { id: string; full_name: string; email?: string };
export type DoctorOption = { id: string; full_name: string | null };
export type AppointmentTypeOption = { id: string; name: string };
export type ProcedureOption = { id: string; name: string; recommendations: string | null };
export type FormTemplateOption = { id: string; name: string };

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
  procedures,
  formTemplates,
  initialPreferences,
}: {
  appointments: AppointmentRow[];
  patients: PatientOption[];
  doctors: DoctorOption[];
  appointmentTypes: AppointmentTypeOption[];
  procedures: ProcedureOption[];
  formTemplates: FormTemplateOption[];
  initialPreferences?: {
    viewMode: ViewMode;
    timelineGranularity: TimelineGranularity;
    calendarGranularity: CalendarGranularity;
    statusFilter?: string[];
    formFilter?: "confirmados_sem_formulario" | "confirmados_com_formulario" | null;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Verificar se deve abrir o formulário automaticamente (ex: ?new=true ou vindo da aba Consulta)
  useEffect(() => {
    const shouldOpenForm = searchParams.get("new") === "true" || searchParams.get("novaConsulta") === "1";
    const patientIdParam = searchParams.get("patientId");
    const patientEmailParam = searchParams.get("patientEmail");
    const doctorIdParam = searchParams.get("doctorId");
    
    if (shouldOpenForm || patientIdParam || patientEmailParam || doctorIdParam) {
      setShowForm(true);
      
      setForm((prev) => {
        let next = { ...prev };
        if (patientIdParam) {
          const patient = patients.find((p) => p.id === patientIdParam);
          if (patient) next = { ...next, patientId: patient.id };
        } else if (patientEmailParam) {
          const patient = patients.find((p) => p.email?.toLowerCase() === patientEmailParam.toLowerCase());
          if (patient) next = { ...next, patientId: patient.id };
        }
        if (doctorIdParam && doctors.some((d) => d.id === doctorIdParam)) {
          next = { ...next, doctorId: doctorIdParam };
        }
        return next;
      });
      
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("new");
      newUrl.searchParams.delete("novaConsulta");
      newUrl.searchParams.delete("patientId");
      newUrl.searchParams.delete("patientEmail");
      newUrl.searchParams.delete("doctorId");
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [searchParams, router, patients, doctors]);
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
  const [statusFilter, setStatusFilter] = useState<string[]>(
    initialPreferences?.statusFilter || []
  );
  const [formFilter, setFormFilter] = useState<"confirmados_sem_formulario" | "confirmados_com_formulario" | null>(
    initialPreferences?.formFilter || null
  );
  const [dateInicio, setDateInicio] = useState(() => todayYMD());
  const [dateFim, setDateFim] = useState(() => todayYMD());
  const [draggedAppointment, setDraggedAppointment] =
    useState<AppointmentRow | null>(null);

  // Calcular dateFim automaticamente baseado na granularidade
  // Usar ref para evitar recalcular quando dateFim é alterado manualmente pelo usuário
  const dateFimManuallySet = useRef(false);
  
  useEffect(() => {
    // Resetar flag quando mudar granularidade ou viewMode
    dateFimManuallySet.current = false;
  }, [viewMode, timelineGranularity, calendarGranularity]);

  useEffect(() => {
    // Se dateFim foi alterado manualmente, não recalcular automaticamente
    if (dateFimManuallySet.current) {
      return;
    }

    if (viewMode === "timeline") {
      const inicioDate = new Date(dateInicio + "T12:00:00");
      let novoFim: Date;

      if (timelineGranularity === "day") {
        // Dia: dateFim = dateInicio
        novoFim = inicioDate;
      } else if (timelineGranularity === "week") {
        // Semana: dateFim = dateInicio + 7 dias
        novoFim = addDays(inicioDate, 7);
      } else if (timelineGranularity === "month") {
        // Mês: dateFim = fim do mês de dateInicio
        novoFim = getEndOfMonth(inicioDate);
      } else {
        novoFim = inicioDate;
      }

      const novoFimYMD = toYMD(novoFim);
      setDateFim(novoFimYMD);
    } else if (viewMode === "calendar") {
      const inicioDate = new Date(dateInicio + "T12:00:00");
      let novoFim: Date;

      if (calendarGranularity === "week") {
        // Semana: sempre mostra a semana completa (segunda a domingo)
        novoFim = getEndOfWeek(inicioDate);
      } else if (calendarGranularity === "month") {
        // Mês: sempre mostra o mês completo
        novoFim = getEndOfMonth(inicioDate);
      } else {
        novoFim = inicioDate;
      }

      const novoFimYMD = toYMD(novoFim);
      setDateFim(novoFimYMD);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateInicio, viewMode, timelineGranularity, calendarGranularity]);
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
  const [selectedFormTemplateId, setSelectedFormTemplateId] = useState("");
  const [publicFormTemplates, setPublicFormTemplates] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!form.patientId) {
      setPublicFormTemplates([]);
      return;
    }
    getPublicFormTemplatesForPatient(form.patientId).then((res) => {
      setPublicFormTemplates(res.data ?? []);
    });
  }, [form.patientId]);


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
      form.notes || null,
      form.recommendations || null,
      form.procedureId || null,
      form.requiresFasting,
      form.requiresMedicationStop,
      form.specialInstructions || null,
      form.preparationNotes || null,
      form.linkedFormTemplateIds.length ? form.linkedFormTemplateIds : undefined
    );
    if (res.error) {
      setError(res.error);
      toast(res.error, "error");
      setLoading(false);
      return;
    }
    setShowForm(false);
    setSelectedFormTemplateId("");
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
    setLoading(false);
  }

  const start = new Date(dateInicio + "T12:00:00");
  const end = new Date(dateFim + "T12:00:00");
  // Garantir início <= fim
  const [rangeStart, rangeEnd] =
    start <= end ? [start, end] : [end, start];
  const calendarDate = rangeStart;

  // Filtrar appointments pelo período e filtros apenas para visualização
  // Mas manter todos os appointments disponíveis para drag and drop
  const appointmentsInPeriod = useMemo(() => {
    const ymdStart = toYMD(rangeStart);
    const ymdEnd = toYMD(rangeEnd);
    
    const filtered = appointments.filter((a) => {
      // Filtro por período
      const d = a.scheduled_at.slice(0, 10);
      if (d < ymdStart || d > ymdEnd) {
        return false;
      }

      // Filtro por status (se nenhum selecionado, mostra todos)
      if (statusFilter.length > 0 && !statusFilter.includes(a.status)) {
        return false;
      }

      // Filtro por formulários
      if (formFilter) {
        // Verificar se a consulta está confirmada (requisito para filtro de formulários)
        if (a.status !== "confirmada") {
          return false;
        }
        
        const formInstances = a.form_instances || [];
        const hasAnsweredForms = formInstances.some(fi => fi.status === "respondido");
        
        if (formFilter === "confirmados_sem_formulario") {
          // Confirmados que ainda não preencheram formulários
          // Não deve ter formulários respondidos
          if (hasAnsweredForms) {
            return false;
          }
        } else if (formFilter === "confirmados_com_formulario") {
          // Confirmados que já preencheram formulários
          // Deve ter pelo menos um formulário respondido
          if (!hasAnsweredForms) {
            return false;
          }
        }
      }

      return true;
    });
    
    return filtered;
  }, [appointments, rangeStart, rangeEnd, statusFilter, formFilter]);

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
    // Também pode ser um ID único como "2026-02-09-14" (dayId-hour) no calendário semanal
    let targetDate: string | null = null;
    let targetHour: number | null = null;
    
    // Tentar extrair dayId do over.data primeiro (se for um DroppableDay)
    const overData = (over.data.current as { dayId?: string; type?: string }) || {};
    if (overData.type === "day" && overData.dayId) {
      // DroppableDay sempre tem dayId nos dados
      targetDate = overData.dayId;
      // Se o uniqueId tem formato dayId-hour, extrair a hora
      if (targetId.match(/^\d{4}-\d{2}-\d{2}-\d+$/)) {
        const parts = targetId.split("-");
        targetHour = parseInt(parts[3], 10);
      }
    } else if (targetId.match(/^\d{4}-\d{2}-\d{2}(-\d+)?$/)) {
      // É um dayId ou dayId-hour - extrair a data e possivelmente a hora
      const parts = targetId.split("-");
      targetDate = parts.slice(0, 3).join("-");
      if (parts.length > 3) {
        targetHour = parseInt(parts[3], 10);
      }
    } else {
      // É outro appointment - neste caso, vamos buscar o DroppableDay pai
      // Mas primeiro, vamos tentar encontrar o appointment e usar seu dayId
      // Isso funciona quando arrastamos sobre um appointment no mesmo dia
      const targetAppointment = allAppointmentsForDrag.find((a) => a.id === targetId);
      if (targetAppointment) {
        // Se arrastamos sobre um appointment, usar o dayId desse appointment
        // Isso mantém o comportamento de reordenar dentro do mesmo dia
        targetDate = targetAppointment.scheduled_at.slice(0, 10);
        // Não mudamos a hora quando arrastamos sobre outro appointment
      } else {
        // Se não encontramos, pode ser que o drop foi em uma área vazia
        // mas o over.id não é um dayId válido - neste caso, não fazer nada
        setDraggedAppointment(null);
        return;
      }
    }

    if (!targetDate) {
      setDraggedAppointment(null);
      return;
    }

    // Usar data local para evitar problemas de timezone
    const oldDate = new Date(draggedAppointment.scheduled_at);
    const oldDateStr = draggedAppointment.scheduled_at.slice(0, 10);
    const oldHour = oldDate.getHours();
    const oldMinute = oldDate.getMinutes();

    // Criar data local a partir do targetDate (YYYY-MM-DD)
    const [year, month, day] = targetDate.split("-").map(Number);
    
    // Determinar a nova hora e minuto
    // Se targetHour foi extraído (arrastou verticalmente no calendário semanal), usar essa hora
    // Caso contrário, manter a hora original
    const newHour = targetHour !== null ? targetHour : oldHour;
    const newMinute = targetHour !== null ? 0 : oldMinute; // Quando muda de hora, definir minutos como 0

    // Reagendar se mudou de dia OU se mudou de hora (no calendário semanal)
    const dateChanged = targetDate !== oldDateStr;
    const hourChanged = targetHour !== null && targetHour !== oldHour;
    
    if (dateChanged || hourChanged) {
      // Converter para ISO string preservando a data local (evita problemas de timezone)
      const isoString = localDateToISO(year, month, day, newHour, newMinute);
      const res = await updateAppointment(draggedAppointment.id, {
        scheduled_at: isoString,
      });

      if (!res.error) {
        // Usar router.refresh() para atualizar dados sem perder estado
        router.refresh();
      } else {
        toast(res.error, "error");
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
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Header com título e botão Nova consulta */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl truncate">Agenda</h1>
        <Button
          className="w-full sm:w-auto min-h-[44px] touch-manipulation shrink-0"
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

      {/* Toolbar: modo, granularidade (calendário), período, filtros */}
      <div className="flex flex-col gap-4 min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex flex-wrap items-center gap-2">
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
                  // O useEffect vai recalcular o dateFim automaticamente
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
                  // O useEffect vai recalcular o dateFim automaticamente
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="week">Semana</option>
                <option value="month">Mês</option>
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {viewMode === "timeline" && timelineGranularity === "day" ? (
              // Timeline Dia: apenas um campo
              <>
                <Label htmlFor="date_inicio" className="text-muted-foreground text-xs sm:text-sm shrink-0">
                  Data
                </Label>
                <Input
                  id="date_inicio"
                  type="date"
                  value={dateInicio}
                  onChange={(e) => setDateInicio(e.target.value)}
                  className="w-[7.5rem] min-w-0 max-w-full text-sm sm:w-40"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    const today = todayYMD();
                    setDateInicio(today);
                  }}
                >
                  Hoje
                </Button>
              </>
            ) : (
              // Timeline Semana/Mês ou Calendário: campos De/Até (compactos no mobile)
              <>
                <Label htmlFor="date_inicio" className="text-muted-foreground text-xs sm:text-sm shrink-0">
                  De
                </Label>
                <Input
                  id="date_inicio"
                  type="date"
                  value={dateInicio}
                  onChange={(e) => {
                    const novoInicio = e.target.value;
                    setDateInicio(novoInicio);
                    if (viewMode === "calendar") {
                      const inicioDate = new Date(novoInicio + "T12:00:00");
                      let novoFim: Date;
                      if (calendarGranularity === "week") {
                        novoFim = getEndOfWeek(inicioDate);
                      } else if (calendarGranularity === "month") {
                        novoFim = getEndOfMonth(inicioDate);
                      } else {
                        novoFim = inicioDate;
                      }
                      setDateFim(toYMD(novoFim));
                    }
                  }}
                  className="w-[7.5rem] min-w-0 max-w-full text-sm sm:w-40"
                />
                {viewMode === "timeline" ? (
                  <>
                    <Label htmlFor="date_fim" className="text-muted-foreground text-xs sm:text-sm shrink-0">
                      até
                    </Label>
                    <Input
                      id="date_fim"
                      type="date"
                      value={dateFim}
                      min={dateInicio}
                      onChange={(e) => {
                        const novoFim = e.target.value;
                        if (novoFim >= dateInicio) {
                          dateFimManuallySet.current = true;
                          setDateFim(novoFim);
                        }
                      }}
                      className="w-[7.5rem] min-w-0 max-w-full text-sm sm:w-40"
                    />
                  </>
                ) : (
                  <>
                    <Label htmlFor="date_fim" className="text-muted-foreground text-xs sm:text-sm shrink-0">
                      até
                    </Label>
                    <Input
                      id="date_fim"
                      type="date"
                      value={dateFim}
                      readOnly
                      className="w-[7.5rem] min-w-0 max-w-full text-sm sm:w-40 bg-muted cursor-not-allowed"
                    />
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    const today = todayYMD();
                    setDateInicio(today);
                  }}
                >
                  Hoje
                </Button>
              </>
            )}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2 sm:border-l sm:pl-4 sm:border-border">
            <AgendaFilters
              statusFilter={statusFilter}
              formFilter={formFilter}
              onStatusChange={(statuses) => {
                setStatusFilter(statuses);
                // Salvar preferências de forma assíncrona sem bloquear
                updateUserPreferences({ agenda_status_filter: statuses }).catch(console.error);
              }}
              onFormChange={(filter) => {
                setFormFilter(filter);
                // Salvar preferências de forma assíncrona sem bloquear
                updateUserPreferences({ agenda_form_filter: filter }).catch(console.error);
              }}
            />
          </div>
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
                  <p className="text-xs text-muted-foreground">
                    Opcional. Pré-preenche recomendações e associa formulários do procedimento.
                  </p>
                </div>
                {/* Vincular formulário — mesmo layout da tela da consulta */}
                <div className="space-y-4 sm:col-span-2">
                  <Card>
                    <CardHeader>
                      <h3 className="font-semibold">Vincular formulário</h3>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {formTemplates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhum formulário cadastrado na clínica.
                        </p>
                      ) : formTemplates.every((ft) => form.linkedFormTemplateIds.includes(ft.id)) ? (
                        <p className="text-sm text-muted-foreground">
                          Todos os formulários disponíveis já estão vinculados a esta consulta.
                        </p>
                      ) : (
                        <>
                          <select
                            value={selectedFormTemplateId}
                            onChange={(e) => setSelectedFormTemplateId(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">Selecione um formulário</option>
                            {formTemplates
                              .filter((ft) => !form.linkedFormTemplateIds.includes(ft.id))
                              .map((ft) => (
                                <option key={ft.id} value={ft.id}>
                                  {ft.name}
                                </option>
                              ))}
                          </select>
                          <Button
                            type="button"
                            onClick={() => {
                              if (!selectedFormTemplateId) return;
                              if (form.linkedFormTemplateIds.includes(selectedFormTemplateId)) return;
                              setForm((f) => ({
                                ...f,
                                linkedFormTemplateIds: [...f.linkedFormTemplateIds, selectedFormTemplateId],
                              }));
                              setSelectedFormTemplateId("");
                            }}
                            disabled={!selectedFormTemplateId}
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            + Vincular formulário
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                  {form.patientId && (
                    <p className="text-xs text-muted-foreground">
                      Se o paciente preencheu formulário público, ele será vinculado automaticamente à consulta.
                    </p>
                  )}
                  <Card>
                    <CardContent className="py-6">
                      {form.linkedFormTemplateIds.length === 0 && publicFormTemplates.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center">
                          Nenhum formulário vinculado a esta consulta.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {form.linkedFormTemplateIds.map((id) => {
                            const ft = formTemplates.find((t) => t.id === id);
                            return (
                              <li
                                key={id}
                                className="flex items-center justify-between rounded-md border border-border p-3"
                              >
                                <span className="font-medium">{ft?.name ?? id}</span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() =>
                                    setForm((f) => ({
                                      ...f,
                                      linkedFormTemplateIds: f.linkedFormTemplateIds.filter((x) => x !== id),
                                    }))
                                  }
                                >
                                  Desvincular
                                </Button>
                              </li>
                            );
                          })}
                          {publicFormTemplates.map((ft) => (
                            <li
                              key={ft.id}
                              className="flex items-center justify-between rounded-md border border-border border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20 p-3"
                            >
                              <span className="font-medium">{ft.name}</span>
                              <Badge variant="secondary" className="shrink-0">
                                Vinculado automaticamente (formulário público)
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
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
                  placeholder="Ex.: Comparecer em jejum de 8 horas. Trazer exames anteriores..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Ao escolher um procedimento acima, o campo é pré-preenchido. Usado em e-mails e mensagens.
                </p>
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
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      {viewMode === "timeline" && (
        <TimelineListView
          appointments={appointmentsInPeriod}
          allAppointmentsForDrag={allAppointmentsForDrag}
          dateInicio={rangeStart}
          dateFim={rangeEnd}
          today={today}
          granularity={timelineGranularity}
        />
      )}
      {viewMode === "calendar" && calendarGranularity === "week" && (
        <CalendarWeekView
          appointments={appointmentsInPeriod}
          currentDate={calendarDate}
          today={today}
        />
      )}
      {viewMode === "calendar" && calendarGranularity === "month" && (
        <CalendarMonthView
          appointments={appointmentsInPeriod}
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
  allAppointmentsForDrag,
  dateInicio,
  dateFim,
  today,
  granularity,
}: {
  appointments: AppointmentRow[];
  allAppointmentsForDrag: AppointmentRow[];
  dateInicio: Date;
  dateFim: Date;
  today: Date;
  granularity: TimelineGranularity;
}) {
  // Usar appointments filtrados para exibir, mas todos para drag and drop
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
  // Usar appointments filtrados para exibição
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
                  const uniqueDropId = `${dayId}-${hour}`;
                  return (
                    <DroppableDay
                      key={uniqueDropId}
                      dayId={dayId}
                      uniqueId={uniqueDropId}
                      className={cn(
                        "p-1 border-r border-border last:border-r-0 min-h-[48px] relative flex flex-col",
                        isSameDay(d, today) && "bg-primary/5"
                      )}
                    >
                      {hourAppointments.length > 0 ? (
                        <SortableContext
                          items={hourAppointments.map((a) => a.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="flex flex-col gap-0.5">
                            {hourAppointments.map((a) => (
                              <DraggableAppointmentItem
                                key={a.id}
                                appointment={a}
                                dayId={dayId}
                                compact
                              />
                            ))}
                          </div>
                        </SortableContext>
                      ) : (
                        // Célula vazia também é drop zone - precisa ter conteúdo mínimo
                        <div className="min-h-[20px] w-full flex-1" />
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
  // Usar appointments filtrados para exibição
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
                              <div key={a.id} className="mb-0.5">
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
  uniqueId,
}: {
  dayId: string;
  children: ReactNode;
  className?: string;
  uniqueId?: string; // ID único para evitar conflitos quando há múltiplos drop zones do mesmo dia
}) {
  // Usar uniqueId se fornecido, senão usar dayId
  const dropId = uniqueId || dayId;
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: {
      type: "day",
      dayId, // Sempre passar dayId nos dados para extrair depois
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
    const bgColor = getStatusBackgroundColor(appointment.status);
    const textColor = getStatusTextColor(appointment.status);
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-1 rounded px-1.5 py-0.5",
          bgColor,
          textColor,
          "hover:opacity-80 transition-opacity"
        )}
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
          className="flex-1 truncate text-xs font-semibold"
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
          className="flex-1 flex items-center gap-1.5 min-w-0"
        >
          <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium tabular-nums shrink-0">
            {new Date(appointment.scheduled_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="truncate">{appointment.patient.full_name}</span>
          {(appointment.appointment_type || appointment.procedure) && (
            <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
              · {[appointment.appointment_type?.name, appointment.procedure?.name]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          {(appointment.form_instances?.filter((f) => f.status === "pendente").length ?? 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              {appointment.form_instances?.filter((f) => f.status === "pendente").length ?? 0} form.
            </Badge>
          )}
          <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <StatusBadgeDropdown
              appointment={appointment}
              onStatusChange={() => {
                // Callback vazio, o router.refresh() já atualiza
              }}
            />
          </div>
        </div>
      </div>
    </li>
  );
}

function StatusBadgeDropdown({
  appointment,
  onStatusChange,
}: {
  appointment: AppointmentRow;
  onStatusChange: (newStatus: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  async function handleStatusChange(newStatus: string) {
    if (newStatus === appointment.status) {
      setIsOpen(false);
      return;
    }

    const res = await updateAppointment(appointment.id, {
      status: newStatus,
    });

    if (!res.error) {
      onStatusChange(newStatus);
      router.refresh();
    } else {
      toast(res.error, "error");
    }

    setIsOpen(false);
  }

  const statusOptions = [
    { value: "agendada", label: "Agendada" },
    { value: "confirmada", label: "Confirmada" },
    { value: "realizada", label: "Realizada" },
    { value: "falta", label: "Falta" },
    { value: "cancelada", label: "Cancelada" },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseDown={(e) => {
          // Prevenir que o drag and drop seja ativado ao clicar no badge
          e.stopPropagation();
        }}
        className="inline-flex items-center gap-1"
      >
        <Badge
          variant={STATUS_VARIANT[appointment.status] ?? "secondary"}
          className={cn(
            "text-xs cursor-pointer hover:opacity-80 font-semibold",
            getStatusBackgroundColor(appointment.status),
            getStatusTextColor(appointment.status)
          )}
        >
          {STATUS_LABEL[appointment.status] ?? appointment.status}
        </Badge>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-[100] bg-background border border-border rounded-md shadow-lg min-w-[120px]">
          <div className="p-1">
            {statusOptions.map((option) => {
              const bgColor = getStatusBackgroundColor(option.value);
              const textColor = getStatusTextColor(option.value);
              const isActive = appointment.status === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleStatusChange(option.value);
                  }}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-xs rounded-sm transition-colors font-semibold",
                    isActive
                      ? `${bgColor} ${textColor}`
                      : "bg-background hover:bg-muted text-foreground"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AppointmentContent({ appointment: a }: { appointment: AppointmentRow }) {
  const time = new Date(a.scheduled_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const pendingForms =
    a.form_instances?.filter((f) => f.status === "pendente").length ?? 0;
  const router = useRouter();

  return (
    <>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium tabular-nums shrink-0">{time}</span>
        <span className="truncate">{a.patient.full_name}</span>
        {(a.appointment_type || a.procedure) && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
            · {[a.appointment_type?.name, a.procedure?.name].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {pendingForms > 0 && (
          <Badge variant="secondary" className="text-xs">
            {pendingForms} form.
          </Badge>
        )}
        <StatusBadgeDropdown
          appointment={a}
          onStatusChange={() => {
            // Callback vazio, o router.refresh() já atualiza
          }}
        />
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
        {(a.appointment_type || a.procedure) && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
            · {[a.appointment_type?.name, a.procedure?.name].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {pendingForms > 0 && (
          <Badge variant="secondary" className="text-xs">
            {pendingForms} form.
          </Badge>
        )}
        <StatusBadgeDropdown
          appointment={a}
          onStatusChange={() => {
            // Callback vazio, o router.refresh() já atualiza
          }}
        />
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
