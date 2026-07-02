"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addMonths,
  getMonthCalendarGrid,
  getStartOfMonth,
  isSameDay,
  parseYMD,
  toYMD,
} from "@/app/dashboard/agenda/agenda-date-utils";
import { formatSlotPeriodLabel } from "@/lib/appointment-conflicts";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DAYS_AHEAD = 30;

type AvailableDay = {
  date: string;
  label: string;
  periods: ("manha" | "tarde")[];
};

type DaySlot = {
  scheduled_at: string;
  scheduled_end_at: string;
  label: string;
  available: boolean;
  reason?: "booked" | "past" | "lunch";
  period: "manha" | "tarde";
};

export type BookingSlotSelection = {
  scheduled_at: string;
  scheduled_end_at: string;
  label: string;
};

type Props = {
  slug: string;
  procedureId: string;
  doctorId: string;
  onSelectSlot: (slot: BookingSlotSelection) => void;
  onBack: () => void;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function maxBookableDate(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + DAYS_AHEAD);
  return d;
}

function formatSelectedDayLabel(dateIso: string): string {
  const d = parseYMD(dateIso);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatSlotConfirmLabel(dateIso: string, timeLabel: string): string {
  const day = formatSelectedDayLabel(dateIso);
  const capitalized = day.charAt(0).toUpperCase() + day.slice(1);
  return `${capitalized} às ${timeLabel}`;
}

export { formatSlotConfirmLabel };

export function BookingCalendar({ slug, procedureId, doctorId, onSelectSlot, onBack }: Props) {
  const today = useMemo(() => startOfToday(), []);
  const maxDate = useMemo(() => maxBookableDate(), []);

  const [viewMonth, setViewMonth] = useState(() => getStartOfMonth(today));
  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [daySlots, setDaySlots] = useState<DaySlot[]>([]);
  const [dayPeriods, setDayPeriods] = useState<("manha" | "tarde")[]>([]);
  const [loadingDays, setLoadingDays] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableDateSet = useMemo(
    () => new Set(availableDays.map((d) => d.date)),
    [availableDays]
  );

  const loadAvailableDays = useCallback(async () => {
    setLoadingDays(true);
    setError(null);
    setSelectedDate(null);
    setDaySlots([]);
    try {
      const params = new URLSearchParams({ procedureId, doctorId });
      const res = await fetch(`/api/public/booking/${slug}/slots?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar dias disponíveis.");
      setAvailableDays(data.days ?? []);
      if ((data.days ?? []).length === 0) {
        setError("Nenhum horário disponível nos próximos dias. Tente outro profissional ou entre em contato.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar dias disponíveis.");
    } finally {
      setLoadingDays(false);
    }
  }, [slug, procedureId, doctorId]);

  useEffect(() => {
    loadAvailableDays();
  }, [loadAvailableDays]);

  const loadDaySlots = async (date: string) => {
    setLoadingSlots(true);
    setError(null);
    try {
      const params = new URLSearchParams({ procedureId, doctorId, date });
      const res = await fetch(`/api/public/booking/${slug}/slots?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar horários.");
      setDaySlots(data.slots ?? []);
      setDayPeriods(data.periods ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar horários.");
      setDaySlots([]);
      setDayPeriods([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSelectDay = (dateIso: string) => {
    setSelectedDate(dateIso);
    loadDaySlots(dateIso);
  };

  const monthLabel = viewMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const capitalizedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const canGoPrev =
    viewMonth.getFullYear() > today.getFullYear() ||
    (viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() > today.getMonth());

  const viewMonthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
  const canGoNext = viewMonthEnd < maxDate;

  const weeks = getMonthCalendarGrid(viewMonth);

  const isDaySelectable = (day: Date): boolean => {
    if (day < today) return false;
    if (day > maxDate) return false;
    return availableDateSet.has(toYMD(day));
  };

  const isDayInRange = (day: Date): boolean => {
    return day >= today && day <= maxDate;
  };

  const hasAvailableSlots = daySlots.some((s) => s.available);

  const slotsByPeriod = (period: "manha" | "tarde") =>
    daySlots.filter((s) => s.period === period);

  return (
    <Card className="rounded-3xl border-[#e8efec] shadow-sm">
      <CardHeader>
        <CardTitle>Escolha o horário</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione um dia no calendário e depois o horário desejado.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loadingDays ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  disabled={!canGoPrev}
                  onClick={() => setViewMonth((m) => addMonths(m, -1))}
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold text-[#1a2e28] capitalize">
                  {capitalizedMonthLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  disabled={!canGoNext}
                  onClick={() => setViewMonth((m) => addMonths(m, 1))}
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="text-center text-[10px] font-medium text-muted-foreground py-1"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((day, di) => {
                      if (!day) {
                        return <div key={di} className="aspect-square" />;
                      }

                      const dateIso = toYMD(day);
                      const selectable = isDaySelectable(day);
                      const inRange = isDayInRange(day);
                      const selected = selectedDate === dateIso;
                      const isToday = isSameDay(day, today);

                      return (
                        <button
                          key={di}
                          type="button"
                          disabled={!selectable}
                          onClick={() => selectable && handleSelectDay(dateIso)}
                          className={cn(
                            "relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all",
                            selectable &&
                              "hover:bg-primary/10 hover:border-primary/30 border border-transparent cursor-pointer",
                            !inRange && "opacity-30 cursor-not-allowed",
                            inRange && !selectable && "text-muted-foreground cursor-not-allowed",
                            selectable && !selected && "text-[#1a2e28] font-medium",
                            selected && "bg-primary text-primary-foreground font-semibold shadow-sm",
                            isToday && !selected && "ring-1 ring-primary/40"
                          )}
                        >
                          {day.getDate()}
                          {selectable && !selected && (
                            <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {selectedDate && (
              <div className="border-t border-[#e8efec] pt-5 space-y-4">
                <h3 className="text-sm font-semibold text-[#1a2e28] capitalize">
                  {formatSelectedDayLabel(selectedDate)}
                </h3>

                {loadingSlots ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : daySlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum horário neste dia.
                  </p>
                ) : (
                  <>
                    {!hasAvailableSlots && (
                      <p className="text-sm text-muted-foreground">
                        Nenhum horário livre neste dia. Escolha outra data.
                      </p>
                    )}

                    {dayPeriods.map((period) => {
                      const periodSlots = slotsByPeriod(period);
                      if (periodSlots.length === 0) return null;

                      return (
                        <div key={period}>
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                            {formatSlotPeriodLabel(period)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {periodSlots.map((slot) => (
                              <button
                                key={slot.scheduled_at}
                                type="button"
                                disabled={!slot.available}
                                onClick={() =>
                                  onSelectSlot({
                                    scheduled_at: slot.scheduled_at,
                                    scheduled_end_at: slot.scheduled_end_at,
                                    label: formatSlotConfirmLabel(selectedDate, slot.label),
                                  })
                                }
                                className={cn(
                                  "rounded-xl border px-3 py-2 text-sm transition-all min-w-[4.5rem]",
                                  slot.available
                                    ? "border-[#e8efec] hover:border-primary/30 hover:bg-[#f7faf9] font-medium text-[#1a2e28]"
                                    : "border-transparent text-muted-foreground line-through opacity-40 cursor-not-allowed"
                                )}
                              >
                                {slot.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </>
        )}

        <Button variant="ghost" size="sm" onClick={onBack}>
          Voltar
        </Button>
      </CardContent>
    </Card>
  );
}
