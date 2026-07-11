"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronDown, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlaygroundCatalog } from "@/lib/virtual-assistant/tools/playground-catalog";
import type { PhoneContext } from "./hooks/use-playground-catalog";
import { DoctorPicker, ProcedurePicker } from "./entity-pickers/catalog-pickers";
import { PatientPicker } from "./entity-pickers/patient-picker";
import { BookingBreadcrumb, type BreadcrumbStep } from "./booking-breadcrumb";
import { TimeChipGrid } from "./time-chip-grid";
import {
  parseDaysFromAiState,
  parseDaysFromResult,
  parseTimesFromAiState,
  parseTimesFromResult,
  getHasMoreDays,
  formatDayTimeSummary,
  type DayOption,
  type TimeOption,
} from "./booking-options-adapter";

type SlotCache = Record<string, { times: TimeOption[]; result: unknown }>;

type Props = {
  catalog: PlaygroundCatalog | null;
  phoneContext: PhoneContext | null;
  aiState: Record<string, unknown>;
  onAiStateChange: (next: Record<string, unknown>) => void;
  formValues: Record<string, string>;
  onFormChange: (values: Record<string, string>) => void;
  lastResult: unknown | null;
  lastToolName?: string;
  running: boolean;
  onFetchDays: () => Promise<void>;
  onFetchTimesForDay: (date: string) => Promise<unknown | null>;
  onLoadMoreDays: (skipDays: number) => Promise<void>;
  onCreateAppointment: (scheduledAt: string, dayLabel: string, timeLabel: string) => Promise<void>;
  showAdvancedParams?: boolean;
  advancedParams?: React.ReactNode;
};

function getBookingField(aiState: Record<string, unknown>, formValues: Record<string, string>, key: string) {
  const booking = aiState.booking as Record<string, unknown> | undefined;
  return String(formValues[key] ?? booking?.[key] ?? aiState[key] ?? "");
}

export function BookingSlotPicker({
  catalog,
  phoneContext,
  aiState,
  onAiStateChange,
  formValues,
  onFormChange,
  lastResult,
  lastToolName,
  running,
  onFetchDays,
  onFetchTimesForDay,
  onLoadMoreDays,
  onCreateAppointment,
  showAdvancedParams,
  advancedParams,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<TimeOption | null>(null);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [slotCache, setSlotCache] = useState<SlotCache>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const doctorId = getBookingField(aiState, formValues, "doctor_id");
  const procedureId = getBookingField(aiState, formValues, "procedure_id");
  const patientId = String(formValues.patient_id ?? aiState.patient_id ?? phoneContext?.patient?.id ?? "");

  const doctorName = catalog?.doctors.find((d) => d.id === doctorId)?.full_name;
  const procedureName = catalog?.procedures.find((p) => p.id === procedureId)?.name;
  const patientName =
    phoneContext?.patient?.full_name ??
    (patientId ? "Paciente selecionado" : undefined);

  const daysFromResult =
    lastToolName === "find_available_slots" && lastResult
      ? parseDaysFromResult(lastResult)
      : [];
  const daysFromState = parseDaysFromAiState(aiState);
  const days = daysFromResult.length > 0 ? daysFromResult : daysFromState;

  const hasMore = lastResult ? getHasMoreDays(lastResult) : { hasMore: false, nextSkipDays: 0 };

  const daysWithCounts = useMemo(() => {
    return days.map((day) => {
      const cached = slotCache[day.date];
      const count = cached?.times.length;
      return {
        ...day,
        slotCount: count,
        periodsLabel:
          count != null
            ? `${count} horário${count !== 1 ? "s" : ""}${day.periodsLabel ? ` · ${day.periodsLabel}` : ""}`
            : day.periodsLabel,
      };
    });
  }, [days, slotCache]);

  const selectedDay = daysWithCounts.find((d) => d.date === selectedDate);
  const timesForSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    if (slotCache[selectedDate]) return slotCache[selectedDate].times;
    if (lastToolName === "find_available_slots" && lastResult) {
      const data = (lastResult as { data?: { mode?: string } }).data;
      if (data?.mode === "times") {
        const parsed = parseTimesFromResult(lastResult, selectedDate, true);
        if (parsed.length) return parsed;
      }
    }
    return parseTimesFromAiState(aiState, selectedDate, true);
  }, [selectedDate, slotCache, lastResult, lastToolName, aiState]);

  const stepLabel = useMemo(() => {
    if (selectedTime) return "Horário selecionado";
    if (selectedDate && timesForSelectedDay.length) return "Escolha um horário";
    if (days.length) return "Escolha um dia";
    return "Configure médico e procedimento";
  }, [selectedTime, selectedDate, timesForSelectedDay.length, days.length]);

  const breadcrumbSteps: BreadcrumbStep[] = useMemo(
    () => [
      {
        key: "patient",
        label: "Paciente",
        value: patientName,
        done: Boolean(patientId || phoneContext?.patient?.id),
      },
      {
        key: "doctor",
        label: "Médico",
        value: doctorName,
        done: Boolean(doctorId),
      },
      {
        key: "procedure",
        label: "Procedimento",
        value: procedureName,
        done: Boolean(procedureId),
      },
      {
        key: "day",
        label: "Dia",
        value: selectedDay?.label,
        done: Boolean(selectedDate),
      },
      {
        key: "time",
        label: "Horário",
        value: selectedTime?.label,
        done: Boolean(selectedTime),
      },
    ],
    [
      patientId,
      phoneContext?.patient?.id,
      patientName,
      doctorId,
      doctorName,
      procedureId,
      procedureName,
      selectedDate,
      selectedDay?.label,
      selectedTime,
    ]
  );

  const handleDayClick = useCallback(
    async (day: DayOption) => {
      setSelectedDate(day.date);
      setSelectedTime(null);

      if (slotCache[day.date]) return;

      setLoadingTimes(true);
      try {
        const result = await onFetchTimesForDay(day.date);
        if (result) {
          const times = parseTimesFromResult(result, day.date, true);
          setSlotCache((prev) => ({ ...prev, [day.date]: { times, result } }));
          onFormChange({ ...formValues, date: day.date });
        }
      } finally {
        setLoadingTimes(false);
      }
    },
    [slotCache, onFetchTimesForDay, onFormChange, formValues]
  );

  const handleTimeSelect = useCallback(
    (time: TimeOption) => {
      setSelectedTime(time);
      const booking = (aiState.booking as Record<string, unknown>) ?? {};
      onAiStateChange({
        ...aiState,
        booking: {
          ...booking,
          pending_slot: time.scheduledAt,
          date: selectedDate ?? booking.date,
          doctor_id: doctorId || booking.doctor_id,
          procedure_id: procedureId || booking.procedure_id,
        },
      });
      onFormChange({ ...formValues, scheduled_at: time.scheduledAt, date: selectedDate ?? "" });
    },
    [aiState, onAiStateChange, selectedDate, doctorId, procedureId, onFormChange, formValues]
  );

  useEffect(() => {
    if (
      lastToolName === "find_available_slots" &&
      lastResult &&
      (lastResult as { data?: { mode?: string } }).data?.mode === "times"
    ) {
      const date = (lastResult as { data?: { date?: string } }).data?.date ?? formValues.date;
      if (date) {
        const times = parseTimesFromResult(lastResult, date, true);
        setSlotCache((prev) => ({ ...prev, [date]: { times, result: lastResult } }));
        setSelectedDate(date);
      }
    }
  }, [lastToolName, lastResult, formValues.date]);

  return (
    <div className="space-y-4 rounded-lg border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-4">
      <div className="space-y-1">
        {procedureName && <p className="text-base font-semibold">{procedureName}</p>}
        {doctorName && <p className="text-sm text-muted-foreground">{doctorName}</p>}
        {days.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {days.length} dia{days.length !== 1 ? "s" : ""} disponíve{days.length !== 1 ? "is" : "l"}
          </p>
        )}
        <p className="text-sm font-medium text-primary">{stepLabel}</p>
      </div>

      <BookingBreadcrumb steps={breadcrumbSteps} />

      {!days.length && (
        <div className="space-y-3 rounded-md border bg-background/80 p-3">
          <p className="text-sm font-medium">Antes de buscar horários</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <DoctorPicker
              catalog={catalog}
              valueId={doctorId}
              onChangeId={(id) => onFormChange({ ...formValues, doctor_id: id })}
            />
            <ProcedurePicker
              catalog={catalog}
              valueId={procedureId}
              onChangeId={(id) => onFormChange({ ...formValues, procedure_id: id })}
              doctorId={doctorId}
            />
          </div>
          {!patientId && (
            <PatientPicker
              valueId={patientId}
              onChangeId={(id) => {
                onFormChange({ ...formValues, patient_id: id });
                onAiStateChange({ ...aiState, patient_id: id });
              }}
            />
          )}
          <Button
            type="button"
            onClick={() => void onFetchDays()}
            disabled={running || !doctorId || !procedureId}
          >
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando dias…
              </>
            ) : (
              <>
                <CalendarClock className="mr-2 h-4 w-4" />
                Buscar dias disponíveis
              </>
            )}
          </Button>
        </div>
      )}

      {days.length > 0 && (
        <div className="space-y-1">
          {daysWithCounts.map((day) => {
            const isSelected = selectedDate === day.date;
            return (
              <div key={day.date} className="rounded-md border bg-background/80">
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40",
                    isSelected && "bg-primary/5"
                  )}
                  onClick={() => void handleDayClick(day)}
                  disabled={loadingTimes && isSelected}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                    )}
                  >
                    {isSelected ? "●" : "○"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", isSelected && "text-primary")}>
                      {day.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {day.slotCount != null
                        ? `${day.slotCount} horário${day.slotCount !== 1 ? "s" : ""} · ${day.periods.map((p) => (p === "manha" ? "Manhã" : "Tarde")).join(" · ")}`
                        : day.periodsLabel}
                    </p>
                  </div>
                  {loadingTimes && isSelected && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                </button>

                {isSelected && (
                  <div className="border-t px-3 py-3 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {day.label}
                    </p>
                    {loadingTimes ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando horários…
                      </div>
                    ) : (
                      <TimeChipGrid
                        times={timesForSelectedDay}
                        selectedId={selectedTime?.scheduledAt}
                        onSelect={handleTimeSelect}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {hasMore.hasMore && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={running}
              onClick={() => void onLoadMoreDays(hasMore.nextSkipDays)}
            >
              Ver mais dias
            </Button>
          )}
        </div>
      )}

      {selectedTime && selectedDay && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Horário selecionado</p>
            <p className="text-sm font-semibold">
              {formatDayTimeSummary(selectedDay.date, selectedTime.label, selectedDay.label)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">
              {selectedTime.scheduledAt}
            </p>
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={running || !patientId}
            onClick={() =>
              void onCreateAppointment(
                selectedTime.scheduledAt,
                selectedDay.label,
                selectedTime.label
              )
            }
          >
            <Play className="mr-2 h-4 w-4" />
            Criar agendamento
          </Button>
          {!patientId && (
            <p className="text-xs text-amber-600">
              Selecione ou use um paciente do contexto antes de agendar.
            </p>
          )}
        </div>
      )}

      {showAdvancedParams && (
        <div className="rounded-md border">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40"
            onClick={() => setAdvancedOpen(!advancedOpen)}
          >
            Parâmetros avançados
            <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
          </button>
          {advancedOpen && <div className="border-t px-3 py-3">{advancedParams}</div>}
        </div>
      )}
    </div>
  );
}
