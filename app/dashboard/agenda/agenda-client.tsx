"use client";

import { useState, useMemo, useRef, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { updateAppointment, updateUserPreferences } from "./actions";
import { AgendaAppointmentModal } from "./agenda-appointment-modal";
import { AgendaEventDetailsSidebar } from "./agenda-event-details-sidebar";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import {
  Plus,
  CalendarClock,
  GripVertical,
  ChevronDown,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Rows3,
  Pencil,
  ExternalLink,
  Ban,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
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
  getAgendaTimeSlots,
  formatAgendaSlotLabel,
  agendaSlotKey,
  parseDropSlotFromId,
  type AgendaTimeSlot,
  getWeekOfMonthLabel,
  iterateDays,
  getWeekStartForPeriod,
  localDateToISO,
} from "./agenda-date-utils";
import { formatAppointmentTimeRange, shiftIntervalPreservingDuration } from "@/lib/appointment-scheduling";
import {
  AGENDA_SLOT_HEIGHT_PX,
  getGridTotalHeightPx,
  layoutOverlappingEvents,
} from "@/lib/agenda-week-layout";
import { WeekCalendarDayColumn } from "./agenda-week-event-block";
import { ScheduleConfigModal, type ScheduleConfigTab } from "./schedule-config-modal";
import { AgendaWaitlistModal } from "./agenda-waitlist-modal";
import { listWaitlistEntries } from "./waitlist-actions";
import {
  expandBlockOccurrences,
  type ScheduleBlockRow,
  type ScheduleBlockCalendarItem,
} from "@/lib/schedule-blocks";
import { getStatusBackgroundColor, getStatusTextColor } from "./status-utils";

/** Retorna className (statuss) ou style (dimensão) para o evento na agenda */
function getAppointmentEventStyle(
  appointment: AppointmentRow,
  colorBy: "status" | "dimension",
  colorByDimensionId: string | null,
  dimensionValues: PricingDimensionValueOption[]
): { className?: string; style?: React.CSSProperties } {
  if (colorBy === "dimension" && colorByDimensionId && dimensionValues.length > 0) {
    const ids = appointment.dimension_value_ids ?? [];
    const value = dimensionValues.find(
      (dv) => dv.dimension_id === colorByDimensionId && ids.includes(dv.id)
    );
    if (value?.cor) {
      const hex = value.cor;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const textColor = luminance > 0.5 ? "#1f2937" : "#f9fafb";
      return { style: { backgroundColor: hex, color: textColor } };
    }
  }
  return {
    className: `${getStatusBackgroundColor(appointment.status)} ${getStatusTextColor(appointment.status)}`,
  };
}

function getAppointmentAccentColor(
  appointment: AppointmentRow,
  colorBy: "status" | "dimension",
  colorByDimensionId: string | null,
  dimensionValues: PricingDimensionValueOption[]
): string {
  if (colorBy === "dimension" && colorByDimensionId && dimensionValues.length > 0) {
    const ids = appointment.dimension_value_ids ?? [];
    const value = dimensionValues.find(
      (dv) => dv.dimension_id === colorByDimensionId && ids.includes(dv.id)
    );
    if (value?.cor) return value.cor;
  }

  const statusLower = appointment.status.toLowerCase();
  if (statusLower === "agendada") return "#3b82f6";
  if (statusLower === "confirmada") return "#10b981";
  if (statusLower === "realizada") return "#8b5cf6";
  if (statusLower === "falta") return "#f59e0b";
  if (statusLower === "cancelada") return "#ef4444";
  return "#94a3b8";
}

export type AppointmentRow = {
  id: string;
  scheduled_at: string;
  scheduled_end_at?: string | null;
  room_id?: string | null;
  room_name?: string | null;
  status: string;
  notes: string | null;
  service_id?: string | null;
  valor?: number | null;
  service_name?: string | null;
  dimension_value_ids?: string[];
  patient: { id: string; full_name: string };
  doctor: { id: string; full_name: string | null };
  appointment_type: { id: string; name: string } | null;
  procedure: { id: string; name: string } | null;
  procedures?: { id: string; name: string }[];
  form_instances?: { id: string; status: string }[];
};

export type PatientOption = { id: string; full_name: string; email?: string };
export type DoctorOption = { id: string; full_name: string | null };
export type RoomOption = { id: string; name: string };
export type ProcedureOption = {
  id: string;
  name: string;
  recommendations: string | null;
  default_service_id?: string | null;
  duration_minutes?: number;
};
export type FormTemplateOption = { id: string; name: string };
export type ServicePriceRuleOption = { serviceId: string; professionalId: string | null };
export type DoctorProcedureLink = { doctorId: string; procedureId: string };

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

function formatAppointmentTooltip(appointment: AppointmentRow): string {
  const time = formatAppointmentTimeRange(
    appointment.scheduled_at,
    appointment.scheduled_end_at
  );
  const procs = (appointment.procedures ?? (appointment.procedure ? [appointment.procedure] : []))
    .map((p) => p.name)
    .join(", ");
  const forms = appointment.form_instances ?? [];
  const formsPending = forms.filter((f) => f.status !== "respondido").length;
  const parts = [
    `${time} — ${appointment.patient.full_name}`,
    appointment.room_name && `Sala: ${appointment.room_name}`,
    procs && `Procedimento(s): ${procs}`,
    appointment.service_name && `Serviço: ${appointment.service_name}`,
    appointment.valor != null &&
      `Valor: ${appointment.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
    forms.length > 0 && `Formulários: ${forms.length - formsPending}/${forms.length} respondidos`,
  ].filter(Boolean);
  return parts.join("\n");
}

export type ServiceOption = { id: string; nome: string };
export type PricingDimensionOption = { id: string; nome: string };
export type PricingDimensionValueOption = { id: string; dimension_id: string; nome: string; cor?: string | null };

export type { ScheduleBlockCalendarItem };

export function AgendaClient({
  appointments,
  agendaStartHour = 7,
  agendaEndHour = 20,
  patients,
  doctors,
  procedures,
  formTemplates,
  services = [],
  pricingDimensions = [],
  pricingDimensionValues = [],
  servicePriceRules = [],
  doctorProcedures = [],
  rooms = [],
  roomsRequired = false,
  scheduleBlocks = [],
  userRole = "secretaria",
  initialPreferences,
}: {
  appointments: AppointmentRow[];
  agendaStartHour?: number;
  agendaEndHour?: number;
  patients: PatientOption[];
  doctors: DoctorOption[];
  procedures: ProcedureOption[];
  formTemplates: FormTemplateOption[];
  services?: ServiceOption[];
  pricingDimensions?: PricingDimensionOption[];
  pricingDimensionValues?: PricingDimensionValueOption[];
  servicePriceRules?: ServicePriceRuleOption[];
  doctorProcedures?: DoctorProcedureLink[];
  rooms?: RoomOption[];
  roomsRequired?: boolean;
  scheduleBlocks?: ScheduleBlockRow[];
  userRole?: string;
  initialPreferences?: {
    viewMode: ViewMode;
    timelineGranularity: TimelineGranularity;
    calendarGranularity: CalendarGranularity;
    statusFilter?: string[];
    formFilter?: "confirmados_sem_formulario" | "confirmados_com_formulario" | null;
    filterByServiceId?: string;
    filterByDoctorId?: string;
    filterByProcedureId?: string;
    filterByRoomId?: string;
    colorBy?: "status" | "dimension";
    colorByDimensionId?: string;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [appointmentModalMode, setAppointmentModalMode] = useState<"create" | "edit">("create");
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [modalInitialForm, setModalInitialForm] = useState<Partial<import("./agenda-appointment-modal").AppointmentFormState>>({});

  function openCreateModal(partial?: Partial<import("./agenda-appointment-modal").AppointmentFormState>) {
    setAppointmentModalMode("create");
    setEditingAppointmentId(null);
    setModalInitialForm(partial ?? {});
    setAppointmentModalOpen(true);
  }

  function openEditModal(appointmentId: string) {
    setAppointmentModalMode("edit");
    setEditingAppointmentId(appointmentId);
    setModalInitialForm({});
    setAppointmentModalOpen(true);
  }

  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);
  const [eventDetailsId, setEventDetailsId] = useState<string | null>(null);

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockModalTab, setBlockModalTab] = useState<ScheduleConfigTab>("create");
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [blockModalInitial, setBlockModalInitial] = useState<
    Partial<{ date: string; timeStart: string; timeEnd: string; doctorId: string }>
  >({});

  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(0);

  function openCreateBlockModal(
    partial?: Partial<{ date: string; timeStart: string; timeEnd: string; doctorId: string }>
  ) {
    setEditingBlockId(null);
    setBlockModalInitial(partial ?? {});
    setBlockModalTab("create");
    setBlockModalOpen(true);
  }

  function openEditBlockModal(blockId: string) {
    setEditingBlockId(blockId);
    setBlockModalInitial({});
    setBlockModalTab("create");
    setBlockModalOpen(true);
  }

  function openEventDetails(appointmentId: string) {
    setEventDetailsId(appointmentId);
    setEventDetailsOpen(true);
  }

  function openFinalizeFromDetails(appointmentId: string) {
    router.push(`/dashboard/agenda/consulta/${appointmentId}?operacional=1`);
  }

  function handleModalOpenChange(open: boolean) {
    setAppointmentModalOpen(open);
    if (!open) {
      setEditingAppointmentId(null);
      setAppointmentModalMode("create");
    }
  }
  
  // Verificar se deve abrir o formulário automaticamente (ex: ?new=true ou vindo da aba Consulta)
  useEffect(() => {
    const shouldOpenForm = searchParams.get("new") === "true" || searchParams.get("novaConsulta") === "1";
    const patientIdParam = searchParams.get("patientId");
    const patientEmailParam = searchParams.get("patientEmail");
    const doctorIdParam = searchParams.get("doctorId");
    
    if (shouldOpenForm || patientIdParam || patientEmailParam || doctorIdParam) {
      const initial: Partial<import("./agenda-appointment-modal").AppointmentFormState> = {};
      if (patientIdParam) {
        const patient = patients.find((p) => p.id === patientIdParam);
        if (patient) initial.patientId = patient.id;
      } else if (patientEmailParam) {
        const patient = patients.find((p) => p.email?.toLowerCase() === patientEmailParam.toLowerCase());
        if (patient) initial.patientId = patient.id;
      }
      if (doctorIdParam && doctors.some((d) => d.id === doctorIdParam)) {
        initial.doctorId = doctorIdParam;
      }
      openCreateModal(initial);
      
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
  const [filterByServiceId, setFilterByServiceId] = useState<string>(
    initialPreferences?.filterByServiceId ?? ""
  );
  const [filterByDoctorId, setFilterByDoctorId] = useState<string>(
    initialPreferences?.filterByDoctorId ?? ""
  );
  const [filterByProcedureId, setFilterByProcedureId] = useState<string>(
    initialPreferences?.filterByProcedureId ?? ""
  );
  const [filterByRoomId, setFilterByRoomId] = useState<string>(
    initialPreferences?.filterByRoomId ?? ""
  );
  const [colorBy, setColorBy] = useState<"status" | "dimension">(
    initialPreferences?.colorBy ?? "status"
  );
  const [colorByDimensionId, setColorByDimensionId] = useState<string>(
    initialPreferences?.colorByDimensionId ?? ""
  );
  const [isMobile, setIsMobile] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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
    const syncMobile = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 640);
    };
    syncMobile();
    window.addEventListener("resize", syncMobile);
    return () => window.removeEventListener("resize", syncMobile);
  }, []);

  useEffect(() => {
    if (userRole !== "admin" && userRole !== "secretaria") return;
    listWaitlistEntries(dateInicio).then((res) => {
      if (!res.error) setWaitlistCount(res.entries.length);
    });
  }, [dateInicio, userRole]);

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
  const today = useMemo(() => new Date(), []);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const start = new Date(dateInicio + "T12:00:00");
  const end = new Date(dateFim + "T12:00:00");
  // Garantir início <= fim
  const [rangeStart, rangeEnd] =
    start <= end ? [start, end] : [end, start];
  const calendarDate = rangeStart;

  // Filtrar appointments pelo período e filtros apenas para visualização
  // Mas manter todos os appointments disponíveis para drag and drop
  const appointmentsInPeriod = useMemo(() => {
    // Na visão de calendário, sempre filtrar pelo período visual completo
    // (semana inteira ou mês inteiro), não apenas pelo dateInicio bruto.
    let effectiveStart = rangeStart;
    let effectiveEnd = rangeEnd;
    if (viewMode === "calendar") {
      if (calendarGranularity === "week") {
        effectiveStart = getStartOfWeek(rangeStart);
        effectiveEnd = getEndOfWeek(rangeStart);
      } else if (calendarGranularity === "month") {
        effectiveStart = getStartOfMonth(rangeStart);
        effectiveEnd = getEndOfMonth(rangeStart);
      }
    }

    const ymdStart = toYMD(effectiveStart);
    const ymdEnd = toYMD(effectiveEnd);
    
    const filtered = appointments.filter((a) => {
      // Filtro por período (dia local — evita mismatch UTC vs toYMD das colunas)
      const d = toYMD(new Date(a.scheduled_at));
      if (d < ymdStart || d > ymdEnd) {
        return false;
      }

      // Filtro por médico
      if (filterByDoctorId && a.doctor.id !== filterByDoctorId) {
        return false;
      }

      // Filtro por procedimento
      if (filterByProcedureId) {
        const procIds = (a.procedures ?? (a.procedure ? [a.procedure] : [])).map((p) => p.id);
        if (!procIds.includes(filterByProcedureId)) {
          return false;
        }
      }

      // Filtro por serviço
      if (filterByServiceId && a.service_id !== filterByServiceId) {
        return false;
      }

      // Filtro por sala
      if (filterByRoomId && a.room_id !== filterByRoomId) {
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
  }, [
    appointments,
    rangeStart,
    rangeEnd,
    viewMode,
    calendarGranularity,
    statusFilter,
    formFilter,
    filterByDoctorId,
    filterByProcedureId,
    filterByServiceId,
    filterByRoomId,
  ]);

  const getEventStyle = useCallback(
    (appointment: AppointmentRow) =>
      getAppointmentEventStyle(appointment, colorBy, colorByDimensionId || null, pricingDimensionValues),
    [colorBy, colorByDimensionId, pricingDimensionValues]
  );
  const getAccentColor = useCallback(
    (appointment: AppointmentRow) =>
      getAppointmentAccentColor(appointment, colorBy, colorByDimensionId || null, pricingDimensionValues),
    [colorBy, colorByDimensionId, pricingDimensionValues]
  );
  const mobilePeriodLabel = useMemo(() => {
    const base = new Date(`${dateInicio}T12:00:00`);
    if (viewMode === "timeline") {
      if (timelineGranularity === "day") {
        return base.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
      }
      if (timelineGranularity === "week") {
        const start = getStartOfWeek(base);
        const end = getEndOfWeek(base);
        return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} - ${end.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}`;
      }
      return base.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    }

    if (calendarGranularity === "week") {
      const start = getStartOfWeek(base);
      const end = getEndOfWeek(base);
      return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} - ${end.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`;
    }
    return base.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [viewMode, timelineGranularity, calendarGranularity, dateInicio]);

  function shiftPeriod(direction: -1 | 1) {
    const base = new Date(`${dateInicio}T12:00:00`);
    let next = new Date(base);
    if (viewMode === "timeline") {
      if (timelineGranularity === "day") {
        next = addDays(base, direction);
      } else if (timelineGranularity === "week") {
        next = addDays(base, direction * 7);
      } else {
        next = new Date(base);
        next.setDate(1);
        next.setMonth(next.getMonth() + direction);
      }
    } else if (calendarGranularity === "week") {
      next = addDays(base, direction * 7);
    } else {
      next = new Date(base);
      next.setDate(1);
      next.setMonth(next.getMonth() + direction);
    }
    dateFimManuallySet.current = false;
    setDateInicio(toYMD(next));
  }
  const activeFiltersCount = [
    statusFilter.length > 0,
    formFilter !== null,
    filterByDoctorId !== "",
    filterByProcedureId !== "",
    filterByServiceId !== "",
    filterByRoomId !== "",
    colorBy === "dimension" && colorByDimensionId !== "",
  ].filter(Boolean).length;

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
    let targetMinute: number | null = null;

    const overData =
      (over.data.current as {
        dayId?: string;
        type?: string;
        slotHour?: number;
        slotMinute?: number;
      }) || {};
    if (overData.type === "day" && overData.dayId) {
      targetDate = overData.dayId;
      if (typeof overData.slotHour === "number") {
        targetHour = overData.slotHour;
        targetMinute = typeof overData.slotMinute === "number" ? overData.slotMinute : 0;
      } else {
        const parsed = parseDropSlotFromId(targetId);
        if (parsed) {
          targetDate = parsed.dayId;
          targetHour = parsed.hour;
          targetMinute = parsed.minute;
        }
      }
    } else if (targetId.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parsed = parseDropSlotFromId(targetId);
      if (parsed) {
        targetDate = parsed.dayId;
        targetHour = parsed.hour;
        targetMinute = parsed.minute;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(targetId)) {
        targetDate = targetId;
      }
    } else {
      // É outro appointment - neste caso, vamos buscar o DroppableDay pai
      // Mas primeiro, vamos tentar encontrar o appointment e usar seu dayId
      // Isso funciona quando arrastamos sobre um appointment no mesmo dia
      const targetAppointment = allAppointmentsForDrag.find((a) => a.id === targetId);
      if (targetAppointment) {
        // Se arrastamos sobre um appointment, usar o dayId desse appointment
        // Isso mantém o comportamento de reordenar dentro do mesmo dia
        targetDate = toYMD(new Date(targetAppointment.scheduled_at));
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
    const oldDateStr = toYMD(oldDate);
    const oldHour = oldDate.getHours();
    const oldMinute = oldDate.getMinutes();

    // Criar data local a partir do targetDate (YYYY-MM-DD)
    const [year, month, day] = targetDate.split("-").map(Number);
    
    // Determinar a nova hora e minuto
    // Se targetHour foi extraído (arrastou verticalmente no calendário semanal), usar essa hora
    // Caso contrário, manter a hora original
    const newHour = targetHour !== null ? targetHour : oldHour;
    const newMinute =
      targetHour !== null && targetMinute !== null ? targetMinute : oldMinute;

    const dateChanged = targetDate !== oldDateStr;
    const timeChanged =
      targetHour !== null &&
      (targetHour !== oldHour || (targetMinute !== null && targetMinute !== oldMinute));

    if (dateChanged || timeChanged) {
      // Converter para ISO string preservando a data local (evita problemas de timezone)
      const isoString = localDateToISO(year, month, day, newHour, newMinute);
      const shifted = shiftIntervalPreservingDuration(
        draggedAppointment.scheduled_at,
        draggedAppointment.scheduled_end_at,
        isoString
      );
      const res = await updateAppointment(draggedAppointment.id, {
        scheduled_at: shifted.scheduled_at,
        scheduled_end_at: shifted.scheduled_end_at,
      });

      if (!res.error) {
        router.refresh();
        if (res.waitlistMatches?.length) {
          toast(
            `Vaga liberada — ${res.waitlistMatches.length} paciente(s) na fila de espera.`,
            "success"
          );
        }
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
      {/* Header: título + ação principal */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl truncate">Agenda</h1>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="icon"
            variant={activeFiltersCount > 0 ? "secondary" : "outline"}
            className={cn("h-10 w-10 rounded-full", activeFiltersCount > 0 && "relative")}
            onClick={() => setMobileFiltersOpen(true)}
            aria-label="Abrir filtros da agenda"
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
            variant="outline"
            className="h-10 w-10 rounded-full sm:hidden"
            onClick={() =>
              openCreateBlockModal(
                doctors.length === 1 ? { doctorId: doctors[0].id } : {}
              )
            }
            aria-label="Indisponibilidades"
          >
            <Ban className="h-4 w-4" />
          </Button>
          {(userRole === "admin" || userRole === "secretaria") && (
            <Button
              size="icon"
              variant={waitlistCount > 0 ? "secondary" : "outline"}
              className={cn("h-10 w-10 rounded-full sm:hidden relative", waitlistCount > 0 && "relative")}
              onClick={() => setWaitlistModalOpen(true)}
              aria-label="Fila de espera"
            >
              <Clock className="h-4 w-4" />
              {waitlistCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] leading-[18px] text-center px-1 font-semibold">
                  {waitlistCount}
                </span>
              )}
            </Button>
          )}
          <Button
            size="icon"
            className="h-10 w-10 rounded-full sm:hidden"
            onClick={() => openCreateModal(doctors.length === 1 ? { doctorId: doctors[0].id } : {})}
            aria-label="Nova consulta"
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            className="hidden sm:inline-flex min-h-[44px] touch-manipulation"
            onClick={() =>
              openCreateBlockModal(
                doctors.length === 1 ? { doctorId: doctors[0].id } : {}
              )
            }
          >
            <Ban className="h-4 w-4 mr-2" />
            Indisponibilidades
          </Button>
          {(userRole === "admin" || userRole === "secretaria") && (
            <Button
              variant={waitlistCount > 0 ? "secondary" : "outline"}
              className={cn("hidden sm:inline-flex min-h-[44px] touch-manipulation relative", waitlistCount > 0 && "pr-3")}
              onClick={() => setWaitlistModalOpen(true)}
            >
              <Clock className="h-4 w-4 mr-2" />
              Fila de espera
              {waitlistCount > 0 && (
                <span className="ml-1.5 min-w-[20px] h-5 rounded-full bg-primary text-primary-foreground text-xs leading-5 text-center px-1.5 font-semibold">
                  {waitlistCount}
                </span>
              )}
            </Button>
          )}
          <Button
            className="hidden sm:inline-flex min-h-[44px] touch-manipulation"
            onClick={() => openCreateModal(doctors.length === 1 ? { doctorId: doctors[0].id } : {})}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova consulta
          </Button>
        </div>
      </div>

      {/* Toolbar único: visualização, período e filtros em blocos claros */}
      <div className="rounded-lg border border-border bg-card p-4 min-w-0">
        <div className="flex flex-col gap-4">
          {/* Linha 1: Visualização + Período */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Visualização</span>
              <div className="grid w-[120px] grid-cols-2 rounded-lg border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={async () => {
                    setViewMode("timeline");
                    await updateUserPreferences({ agenda_view_mode: "timeline" });
                  }}
                  className={cn(
                    "h-8 rounded-md text-sm font-medium transition-colors",
                    viewMode === "timeline"
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "text-muted-foreground"
                  )}
                  aria-label="Visualização em timeline"
                  title="Timeline"
                >
                  <span className="mx-auto inline-flex items-center justify-center">
                    <Rows3 className="h-4 w-4" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setViewMode("calendar");
                    await updateUserPreferences({ agenda_view_mode: "calendar" });
                  }}
                  className={cn(
                    "h-8 rounded-md text-sm font-medium transition-colors",
                    viewMode === "calendar"
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "text-muted-foreground"
                  )}
                  aria-label="Visualização em calendário"
                  title="Calendário"
                >
                  <span className="mx-auto inline-flex items-center justify-center">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                </button>
              </div>
            </div>

            <div
              className={cn(
                "rounded-lg border border-border bg-muted/40 p-1 grid",
                viewMode === "timeline" ? "grid-cols-3" : "grid-cols-2"
              )}
            >
              {(viewMode === "timeline"
                ? [
                    { id: "day", label: "Dia" },
                    { id: "week", label: "Semana" },
                    { id: "month", label: "Mês" },
                  ]
                : [
                    { id: "week", label: "Semana" },
                    { id: "month", label: "Mês" },
                  ]
              ).map((opt) => {
                const isActive =
                  viewMode === "timeline"
                    ? timelineGranularity === (opt.id as TimelineGranularity)
                    : calendarGranularity === (opt.id as CalendarGranularity);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={async () => {
                      if (viewMode === "timeline") {
                        const g = opt.id as TimelineGranularity;
                        setTimelineGranularity(g);
                        await updateUserPreferences({ agenda_timeline_granularity: g });
                      } else {
                        const g = opt.id as CalendarGranularity;
                        setCalendarGranularity(g);
                        await updateUserPreferences({ agenda_calendar_granularity: g });
                      }
                    }}
                    className={cn(
                      "h-8 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "text-muted-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      </div>
      <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <DialogContent title="Filtros da agenda" onClose={() => setMobileFiltersOpen(false)}>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS_LABEL).map(([value, label]) => {
                  const active = statusFilter.includes(value);
                  return (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={active ? "secondary" : "outline"}
                      className={cn("h-8", active && "border-primary bg-primary/10 text-primary")}
                      onClick={() => {
                        const next = active
                          ? statusFilter.filter((s) => s !== value)
                          : [...statusFilter, value];
                        setStatusFilter(next);
                        updateUserPreferences({ agenda_status_filter: next }).catch(console.error);
                      }}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
            {doctors.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Profissional</Label>
                <select
                  value={filterByDoctorId}
                  onChange={async (e) => {
                    const v = e.target.value;
                    setFilterByDoctorId(v);
                    await updateUserPreferences({ agenda_filter_by_doctor_id: v || undefined });
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Todos</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name}</option>
                  ))}
                </select>
              </div>
            )}
            {procedures.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Procedimento</Label>
                <select
                  value={filterByProcedureId}
                  onChange={async (e) => {
                    const v = e.target.value;
                    setFilterByProcedureId(v);
                    await updateUserPreferences({ agenda_filter_by_procedure_id: v || undefined });
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Todos</option>
                  {procedures.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Formulários</Label>
              <select
                value={formFilter ?? ""}
                onChange={(e) => {
                  const value = e.target.value as "confirmados_sem_formulario" | "confirmados_com_formulario" | "";
                  const next = value === "" ? null : value;
                  setFormFilter(next);
                  updateUserPreferences({ agenda_form_filter: next }).catch(console.error);
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos os formulários</option>
                <option value="confirmados_sem_formulario">Confirmados sem formulário</option>
                <option value="confirmados_com_formulario">Confirmados com formulário</option>
              </select>
            </div>
            {services.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Serviço</Label>
                <select
                  value={filterByServiceId}
                  onChange={async (e) => {
                    const v = e.target.value;
                    setFilterByServiceId(v);
                    await updateUserPreferences({ agenda_filter_by_service_id: v || undefined });
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Todos</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
            )}
            {rooms.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sala</Label>
                <select
                  value={filterByRoomId}
                  onChange={async (e) => {
                    const v = e.target.value;
                    setFilterByRoomId(v);
                    await updateUserPreferences({ agenda_filter_by_room_id: v || undefined });
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Todas</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}
            {(services.length > 0 || pricingDimensions.length > 0) && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Critério de cor</Label>
                <select
                  value={colorBy === "dimension" ? colorByDimensionId : "status"}
                  onChange={async (e) => {
                    const v = e.target.value;
                    if (v === "status") {
                      setColorBy("status");
                      setColorByDimensionId("");
                      await updateUserPreferences({ agenda_color_by: "status", agenda_color_by_dimension_id: "" });
                    } else {
                      setColorBy("dimension");
                      setColorByDimensionId(v);
                      await updateUserPreferences({ agenda_color_by: "dimension", agenda_color_by_dimension_id: v });
                    }
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="status">Status</option>
                  {pricingDimensions.map((d) => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter([]);
                  setFormFilter(null);
                  setFilterByDoctorId("");
                  setFilterByProcedureId("");
                  setFilterByServiceId("");
                  setFilterByRoomId("");
                  setColorBy("status");
                  setColorByDimensionId("");
                  updateUserPreferences({
                    agenda_status_filter: [],
                    agenda_form_filter: null,
                    agenda_filter_by_doctor_id: undefined,
                    agenda_filter_by_procedure_id: undefined,
                    agenda_filter_by_service_id: undefined,
                    agenda_filter_by_room_id: undefined,
                    agenda_color_by: "status",
                    agenda_color_by_dimension_id: "",
                  }).catch(console.error);
                }}
              >
                Limpar tudo
              </Button>
              <Button type="button" size="sm" onClick={() => setMobileFiltersOpen(false)}>
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border border-border bg-card p-4 min-w-0">
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Período</span>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => shiftPeriod(-1)}
              aria-label="Período anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="flex-1 text-center text-sm font-semibold capitalize">{mobilePeriodLabel}</p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => shiftPeriod(1)}
              aria-label="Próximo período"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-full" onClick={() => setDateInicio(todayYMD())}>
            Hoje
          </Button>
        </div>
      </div>

      <AgendaAppointmentModal
        open={appointmentModalOpen}
        onOpenChange={handleModalOpenChange}
        mode={appointmentModalMode}
        appointmentId={editingAppointmentId}
        onSuccess={(appointmentId) => {
          router.refresh();
          if (appointmentId) openEventDetails(appointmentId);
        }}
        initialForm={modalInitialForm}
        patients={patients}
        doctors={doctors}
        procedures={procedures}
        formTemplates={formTemplates}
        services={services}
        pricingDimensions={pricingDimensions}
        pricingDimensionValues={pricingDimensionValues}
        servicePriceRules={servicePriceRules}
        doctorProcedures={doctorProcedures}
        rooms={rooms}
        roomsRequired={roomsRequired}
        userRole={userRole}
      />

      <ScheduleConfigModal
        open={blockModalOpen}
        onOpenChange={(open) => {
          setBlockModalOpen(open);
          if (!open) setEditingBlockId(null);
        }}
        doctors={doctors}
        userRole={userRole}
        editingBlockId={editingBlockId}
        initialPartial={blockModalInitial}
        initialTab={blockModalTab}
      />

      {(userRole === "admin" || userRole === "secretaria") && (
        <AgendaWaitlistModal
          open={waitlistModalOpen}
          onOpenChange={(open) => {
            setWaitlistModalOpen(open);
            if (!open && (userRole === "admin" || userRole === "secretaria")) {
              listWaitlistEntries(dateInicio).then((res) => {
                if (!res.error) setWaitlistCount(res.entries.length);
              });
            }
          }}
          defaultDate={dateInicio}
          doctors={doctors}
        />
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
          getEventStyle={getEventStyle}
          getAccentColor={getAccentColor}
          onEditAppointment={openEditModal}
          onOpenDetails={openEventDetails}
        />
      )}
      {viewMode === "calendar" && calendarGranularity === "week" && (
        <CalendarWeekView
          appointments={appointmentsInPeriod}
          scheduleBlocks={scheduleBlocks}
          currentDate={calendarDate}
          today={today}
          timeSlots={getAgendaTimeSlots(agendaStartHour, agendaEndHour)}
          getEventStyle={getEventStyle}
          getAccentColor={getAccentColor}
          onEditAppointment={openEditModal}
          onOpenDetails={openEventDetails}
          onEditBlock={openEditBlockModal}
        />
      )}
      {viewMode === "calendar" && calendarGranularity === "month" && (
        <CalendarMonthView
          appointments={appointmentsInPeriod}
          currentDate={calendarDate}
          today={today}
          getEventStyle={getEventStyle}
          getAccentColor={getAccentColor}
          onEditAppointment={openEditModal}
          onOpenDetails={openEventDetails}
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
              <AppointmentListItem appointment={draggedAppointment} onOpenDetails={openEventDetails} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AgendaEventDetailsSidebar
        appointmentId={eventDetailsId}
        open={eventDetailsOpen}
        onClose={() => {
          setEventDetailsOpen(false);
          setEventDetailsId(null);
        }}
        onEdit={(id) => {
          setEventDetailsOpen(false);
          openEditModal(id);
        }}
        onFinalize={openFinalizeFromDetails}
      />
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
  getEventStyle,
  getAccentColor,
  onEditAppointment,
  onOpenDetails,
}: {
  appointments: AppointmentRow[];
  allAppointmentsForDrag: AppointmentRow[];
  dateInicio: Date;
  dateFim: Date;
  today: Date;
  granularity: TimelineGranularity;
  getEventStyle: (appointment: AppointmentRow) => { className?: string; style?: React.CSSProperties };
  getAccentColor: (appointment: AppointmentRow) => string;
  onEditAppointment?: (appointmentId: string) => void;
  onOpenDetails?: (appointmentId: string) => void;
}) {
  // Usar appointments filtrados para exibir, mas todos para drag and drop
  const byDay = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    appointments.forEach((a) => {
      const key = toYMD(new Date(a.scheduled_at));
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
                      getEventStyle={getEventStyle}
                      getAccentColor={getAccentColor}
                      onEdit={onEditAppointment}
                      onOpenDetails={onOpenDetails}
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
                              getEventStyle={getEventStyle}
                              getAccentColor={getAccentColor}
                              onEdit={onEditAppointment}
                      onOpenDetails={onOpenDetails}
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
                                    getEventStyle={getEventStyle}
                                    getAccentColor={getAccentColor}
                                    onEdit={onEditAppointment}
                      onOpenDetails={onOpenDetails}
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

function CalendarWeekView({
  appointments,
  scheduleBlocks,
  currentDate,
  today,
  timeSlots,
  getEventStyle,
  getAccentColor,
  onEditAppointment,
  onOpenDetails,
  onEditBlock,
}: {
  appointments: AppointmentRow[];
  scheduleBlocks: ScheduleBlockRow[];
  currentDate: Date;
  today: Date;
  timeSlots: AgendaTimeSlot[];
  getEventStyle: (appointment: AppointmentRow) => { className?: string; style?: React.CSSProperties };
  getAccentColor: (appointment: AppointmentRow) => string;
  onEditAppointment?: (appointmentId: string) => void;
  onOpenDetails?: (appointmentId: string) => void;
  onEditBlock?: (blockId: string) => void;
}) {
  const weekDays = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedDayYmd, setSelectedDayYmd] = useState(() => toYMD(currentDate));

  useEffect(() => {
    const syncMobile = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 640);
    };
    syncMobile();
    window.addEventListener("resize", syncMobile);
    return () => window.removeEventListener("resize", syncMobile);
  }, []);

  useEffect(() => {
    const dayInWeek = weekDays.find((d) => toYMD(d) === selectedDayYmd);
    if (!dayInWeek && weekDays[0]) {
      setSelectedDayYmd(toYMD(weekDays[0]));
    }
  }, [weekDays, selectedDayYmd]);

  const byDay = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    appointments.forEach((a) => {
      const key = toYMD(new Date(a.scheduled_at));
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    Object.keys(map).forEach((k) => {
      map[k].sort(
        (x, y) => new Date(x.scheduled_at).getTime() - new Date(y.scheduled_at).getTime()
      );
    });
    return map;
  }, [appointments]);

  // Sempre calcular para manter ordem de hooks estável entre mobile/desktop
  const gridStartHour = timeSlots[0]?.hour ?? 7;
  const gridEndHour = timeSlots[timeSlots.length - 1]?.hour ?? 20;
  const gridTotalHeightPx = getGridTotalHeightPx(timeSlots.length);

  const layoutsByDay = useMemo(() => {
    const map: Record<string, ReturnType<typeof layoutOverlappingEvents>> = {};
    weekDays.forEach((d) => {
      const dayId = toYMD(d);
      const items = (byDay[dayId] ?? []).map((a) => ({
        id: a.id,
        scheduledAt: a.scheduled_at,
        scheduledEndAt: a.scheduled_end_at,
      }));
      map[dayId] = layoutOverlappingEvents(items, gridStartHour, gridEndHour);
    });
    return map;
  }, [byDay, weekDays, gridStartHour, gridEndHour]);

  const blocksByDay = useMemo(() => {
    const map: Record<string, ScheduleBlockCalendarItem[]> = {};
    if (!scheduleBlocks.length || !weekDays.length) return map;

    const rangeStart = new Date(weekDays[0]);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(weekDays[weekDays.length - 1]);
    rangeEnd.setHours(23, 59, 59, 999);

    for (const block of scheduleBlocks) {
      const occurrences = expandBlockOccurrences(block, rangeStart, rangeEnd);
      for (const occ of occurrences) {
        const dayKey = toYMD(new Date(occ.startsAt));
        if (!map[dayKey]) map[dayKey] = [];
        map[dayKey].push({
          ...occ,
          occurrenceKey: `${occ.blockId}-${occ.startsAt}`,
        });
      }
    }
    return map;
  }, [scheduleBlocks, weekDays]);

  if (isMobile) {
    const selectedDayDate = weekDays.find((d) => toYMD(d) === selectedDayYmd) ?? weekDays[0] ?? today;
    const selectedDayList = byDay[toYMD(selectedDayDate)] ?? [];

    return (
      <Card>
        <CardContent className="space-y-4 pt-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {weekDays.map((d) => {
              const dayKey = toYMD(d);
              const isSelected = dayKey === selectedDayYmd;
              const hasEvents = (byDay[dayKey]?.length ?? 0) > 0;
              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => setSelectedDayYmd(dayKey)}
                  className={cn(
                    "min-w-[56px] rounded-lg border px-2 py-2 text-center",
                    isSelected
                      ? "border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/20"
                      : "border-border bg-background hover:bg-muted/50"
                  )}
                >
                  <p className={cn("text-[10px] uppercase", isSelected ? "text-primary-foreground/90" : "text-muted-foreground")}>
                    {formatDayShort(d)}
                  </p>
                  <p className="text-base font-semibold leading-tight">{d.getDate()}</p>
                  <span
                    className={cn(
                      "mx-auto mt-1 block h-1.5 w-1.5 rounded-full",
                      hasEvents ? (isSelected ? "bg-primary-foreground" : "bg-primary") : "bg-transparent"
                    )}
                  />
                </button>
              );
            })}
          </div>
          <div className="rounded-lg border border-border">
            <div className="border-b border-border px-3 py-2">
              <p className="text-sm font-medium capitalize">
                {selectedDayDate.toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="p-2">
              {(selectedDayList.length === 0 && (blocksByDay[toYMD(selectedDayDate)]?.length ?? 0) === 0) ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">Sem consultas para este dia.</p>
              ) : (
                <div className="space-y-2">
                  {(blocksByDay[toYMD(selectedDayDate)] ?? []).map((block) => (
                    <button
                      key={block.occurrenceKey}
                      type="button"
                      className="w-full rounded-md border border-dashed border-muted-foreground/40 bg-muted/50 px-3 py-2 text-left text-sm"
                      onClick={() => onEditBlock?.(block.blockId)}
                    >
                      <p className="font-medium text-muted-foreground">
                        {block.title?.trim() || "Indisponível"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatAppointmentTimeRange(block.startsAt, block.endsAt)}
                      </p>
                    </button>
                  ))}
                  {selectedDayList.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onOpenDetails?.(a.id)}
                      className="w-full flex items-center justify-between gap-3 rounded-md border border-border border-l-2 px-3 py-2 hover:bg-muted/40 text-left"
                      style={{ borderLeftColor: getAccentColor(a) }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {new Date(a.scheduled_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-sm truncate">{a.patient.full_name}</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground">
          Grade semanal por horário. Bloqueios aparecem em cinza listrado.
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
          <div className="grid grid-cols-[56px_1fr]">
            <div
              className="relative border-r border-border bg-muted/30"
              style={{ height: gridTotalHeightPx }}
            >
              {timeSlots.map((slot, slotIndex) => {
                const showLabel = slot.minute === 0 || slot.minute === 30;
                if (!showLabel) return null;
                return (
                  <div
                    key={agendaSlotKey(slot)}
                    className={cn(
                      "absolute right-1 pr-1 text-right text-[10px] text-muted-foreground -translate-y-1/2",
                      slot.minute === 30 && "opacity-70"
                    )}
                    style={{ top: slotIndex * AGENDA_SLOT_HEIGHT_PX + AGENDA_SLOT_HEIGHT_PX / 2 }}
                  >
                    {formatAgendaSlotLabel(slot)}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7">
              {weekDays.map((d) => {
                const dayId = toYMD(d);
                return (
                  <WeekCalendarDayColumn
                    key={dayId}
                    dayId={dayId}
                    isToday={isSameDay(d, today)}
                    timeSlots={timeSlots}
                    gridTotalHeightPx={gridTotalHeightPx}
                    appointments={byDay[dayId] ?? []}
                    layouts={layoutsByDay[dayId] ?? []}
                    blockItems={blocksByDay[dayId] ?? []}
                    gridStartHour={gridStartHour}
                    gridEndHour={gridEndHour}
                    getAccentColor={getAccentColor}
                    onEditAppointment={onEditAppointment}
                    onOpenDetails={onOpenDetails}
                    onEditBlock={onEditBlock}
                    formatTooltip={formatAppointmentTooltip}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarMonthView({
  appointments,
  currentDate,
  today,
  getEventStyle,
  getAccentColor,
  onSelectDay,
  onEditAppointment,
  onOpenDetails,
}: {
  appointments: AppointmentRow[];
  currentDate: Date;
  today: Date;
  getEventStyle: (appointment: AppointmentRow) => { className?: string; style?: React.CSSProperties };
  getAccentColor: (appointment: AppointmentRow) => string;
  onSelectDay: (d: Date) => void;
  onEditAppointment?: (appointmentId: string) => void;
  onOpenDetails?: (appointmentId: string) => void;
}) {
  const grid = getMonthCalendarGrid(currentDate);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedDayYmd, setSelectedDayYmd] = useState<string | null>(null);

  useEffect(() => {
    const syncMobile = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 640);
    };
    syncMobile();
    window.addEventListener("resize", syncMobile);
    return () => window.removeEventListener("resize", syncMobile);
  }, []);

  // Usar appointments filtrados para exibição
  const byDay = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    appointments.forEach((a) => {
      const key = toYMD(new Date(a.scheduled_at));
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [appointments]);

  const selectedDayDate = selectedDayYmd
    ? new Date(`${selectedDayYmd}T12:00:00`)
    : null;
  const selectedDayAppointments = selectedDayYmd ? byDay[selectedDayYmd] ?? [] : [];

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
                      onClick={() => {
                        if (isMobile) {
                          setSelectedDayYmd(toYMD(day));
                          return;
                        }
                        onSelectDay(day);
                      }}
                      className={cn(
                        "w-7 h-7 rounded-full text-sm font-medium flex items-center justify-center hover:bg-muted self-start",
                        isSameDay(day, today) &&
                          "bg-primary text-primary-foreground"
                      )}
                    >
                      {day.getDate()}
                    </button>
                    {isMobile ? (
                      <button
                        type="button"
                        onClick={() => setSelectedDayYmd(toYMD(day))}
                        className="mt-1 space-y-1 flex-1 overflow-hidden min-h-[60px] w-full text-left"
                      >
                        {(byDay[toYMD(day)] ?? []).length > 0 && (
                          <div className="flex items-center gap-1.5">
                            {(byDay[toYMD(day)] ?? []).slice(0, 3).map((a) => (
                              <span
                                key={a.id}
                                className="inline-block h-2 w-2 rounded-full bg-primary/80"
                              />
                            ))}
                            {(byDay[toYMD(day)] ?? []).length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{(byDay[toYMD(day)] ?? []).length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    ) : (
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
                                    getEventStyle={getEventStyle}
                                    getAccentColor={getAccentColor}
                                    onEdit={onEditAppointment}
                      onOpenDetails={onOpenDetails}
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
                    )}
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </CardContent>
      <Dialog
        open={isMobile && selectedDayYmd !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDayYmd(null);
        }}
      >
        <DialogContent
          title={
            selectedDayDate
              ? `Eventos de ${selectedDayDate.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}`
              : "Eventos do dia"
          }
          onClose={() => setSelectedDayYmd(null)}
        >
          <div className="space-y-3">
            {selectedDayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem eventos para este dia.</p>
            ) : (
              selectedDayAppointments
                .sort(
                  (a, b) =>
                    new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
                )
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelectedDayYmd(null);
                      onOpenDetails?.(a.id);
                    }}
                    className="w-full flex items-center justify-between gap-3 rounded-md border border-border border-l-2 px-3 py-2 hover:bg-muted/40 text-left"
                    style={{ borderLeftColor: getAccentColor(a) }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.patient.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.scheduled_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {(a.procedures?.length || a.procedure) &&
                          ` · ${(a.procedures ?? (a.procedure ? [a.procedure] : [])).map((p) => p.name).join(", ")}`}
                      </p>
                      {(a.service_name || a.valor != null) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[a.service_name, a.valor != null ? a.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </Badge>
                  </button>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DroppableDay({
  dayId,
  children,
  className,
  uniqueId,
  slotHour,
  slotMinute,
}: {
  dayId: string;
  children: ReactNode;
  className?: string;
  uniqueId?: string;
  slotHour?: number;
  slotMinute?: number;
}) {
  const dropId = uniqueId || dayId;
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: {
      type: "day",
      dayId,
      ...(typeof slotHour === "number"
        ? { slotHour, slotMinute: slotMinute ?? 0 }
        : {}),
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
  getEventStyle,
  getAccentColor,
  onEdit,
  onOpenDetails,
}: {
  appointment: AppointmentRow;
  dayId: string;
  compact?: boolean;
  getEventStyle?: (appointment: AppointmentRow) => { className?: string; style?: React.CSSProperties };
  getAccentColor?: (appointment: AppointmentRow) => string;
  onEdit?: (appointmentId: string) => void;
  onOpenDetails?: (appointmentId: string) => void;
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

  const baseStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const accentColor = getAccentColor?.(appointment);
  const timeLabel = formatAppointmentTimeRange(
    appointment.scheduled_at,
    appointment.scheduled_end_at
  );

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={{
          ...baseStyle,
          borderLeftColor: accentColor,
        }}
        className={cn(
          "flex items-center gap-1 rounded border border-border border-l-2 bg-background px-1.5 py-0.5 text-foreground hover:bg-muted/40 transition-colors min-h-[22px]"
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
        {onEdit && (
          <button
            type="button"
            className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
            title="Editar consulta"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(appointment.id);
            }}
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenDetails?.(appointment.id)}
          className="flex-1 truncate text-xs font-semibold text-left hover:underline"
          title={formatAppointmentTooltip(appointment)}
        >
          {appointment.patient.full_name}
          {appointment.procedures?.length || appointment.procedure ? (
            <span className="text-muted-foreground font-normal">
              {" "}
              · {(appointment.procedures ?? (appointment.procedure ? [appointment.procedure] : []))
                .map((p) => p.name)
                .join(", ")}
            </span>
          ) : null}
        </button>
        <Link
          href={`/dashboard/agenda/consulta/${appointment.id}`}
          className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
          title="Abrir consulta"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={baseStyle}
      className="py-3 first:pt-0"
    >
      <div
        className="flex items-center gap-2 hover:bg-muted/50 -mx-2 border-l-2 px-2 py-1 rounded group"
        style={{ borderLeftColor: accentColor }}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          type="button"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onOpenDetails?.(appointment.id)}
          className="flex-1 flex items-center gap-1.5 min-w-0 text-left hover:underline"
        >
          <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium tabular-nums shrink-0">
            {timeLabel}
          </span>
          <span className="truncate">{appointment.patient.full_name}</span>
          {(appointment.procedure || appointment.procedures?.length || appointment.service_name || appointment.valor != null) && (
            <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
              ·{" "}
              {[
                (appointment.procedures ?? (appointment.procedure ? [appointment.procedure] : []))
                  .map((p) => p.name)
                  .join(", ") || null,
                appointment.service_name,
                appointment.valor != null
                  ? appointment.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </button>
        <Link
          href={`/dashboard/agenda/consulta/${appointment.id}`}
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          title="Abrir consulta"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          {onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Editar consulta"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(appointment.id);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
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
        {(a.procedure || a.procedures?.length || a.service_name) && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
            ·{" "}
            {[
              (a.procedures ?? (a.procedure ? [a.procedure] : [])).map((p) => p.name).join(", ") ||
                null,
              a.service_name,
            ]
              .filter(Boolean)
              .join(" · ")}
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
  onOpenDetails,
}: {
  appointment: AppointmentRow;
  compact?: boolean;
  onOpenDetails?: (appointmentId: string) => void;
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
        {(a.procedure || a.procedures?.length || a.service_name) && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
            ·{" "}
            {[
              (a.procedures ?? (a.procedure ? [a.procedure] : [])).map((p) => p.name).join(", ") ||
                null,
              a.service_name,
            ]
              .filter(Boolean)
              .join(" · ")}
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
      <button
        type="button"
        onClick={() => onOpenDetails?.(a.id)}
        className="block w-full text-xs rounded border border-border bg-card px-1.5 py-1 hover:bg-muted/50 mb-0.5 flex items-center justify-between gap-2 text-left"
      >
        {content}
      </button>
    );
  }

  return (
    <li className="py-3 first:pt-0">
      <button
        type="button"
        onClick={() => onOpenDetails?.(a.id)}
        className="w-full flex items-center justify-between gap-4 hover:bg-muted/50 -mx-2 px-2 py-1 rounded min-w-0 text-left"
      >
        {content}
      </button>
    </li>
  );
}


