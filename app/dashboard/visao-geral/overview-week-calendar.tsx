"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWeekDates, formatDayShort, toYMD } from "@/app/dashboard/agenda/agenda-date-utils";
import { getStatusBackgroundColor, getStatusTextColor } from "@/app/dashboard/agenda/status-utils";
import type { VisaoGeralWeekAppointment } from "./actions";

const MAX_VISIBLE_PER_DAY = 4;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatWeekRangeLabel(weekStart: Date): string {
  const dates = getWeekDates(weekStart);
  const first = dates[0];
  const last = dates[6];
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${fmt(first)} – ${fmt(last)}`;
}

export function OverviewWeekCalendar({
  weekStart,
  appointments,
  selectedProcedureId,
  onPrevWeek,
  onNextWeek,
  loading,
}: {
  weekStart: Date;
  appointments: VisaoGeralWeekAppointment[];
  selectedProcedureId: string | null;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  loading?: boolean;
}) {
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, VisaoGeralWeekAppointment[]>();
    for (const d of weekDates) {
      map.set(toYMD(d), []);
    }
    for (const appt of appointments) {
      const key = toYMD(new Date(appt.scheduled_at));
      const list = map.get(key);
      if (list) list.push(appt);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    }
    return map;
  }, [appointments, weekDates]);

  const todayKey = toYMD(new Date());

  return (
    <Card className="flex h-full min-h-[360px] flex-col">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1">
          <span className="text-base font-semibold">Agenda da semana</span>
          <p className="text-sm text-muted-foreground">{formatWeekRangeLabel(weekStart)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onPrevWeek}
              disabled={loading}
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onNextWeek}
              disabled={loading}
              aria-label="Próxima semana"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link href="/dashboard/agenda">
              <CalendarDays className="mr-1 h-3.5 w-3.5" />
              Agenda completa
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn("min-h-0 flex-1", loading && "opacity-60")}>
        <div className="grid h-full grid-cols-7 gap-1 sm:gap-2">
          {weekDates.map((date) => {
            const dayKey = toYMD(date);
            const dayAppointments = appointmentsByDay.get(dayKey) ?? [];
            const isToday = dayKey === todayKey;

            return (
              <div
                key={dayKey}
                className={cn(
                  "flex min-h-[280px] flex-col rounded-lg border border-border/60 bg-muted/20",
                  isToday && "border-primary/30 bg-primary/[0.04]"
                )}
              >
                <div
                  className={cn(
                    "border-b border-border/50 px-1 py-2 text-center sm:px-2",
                    isToday && "bg-primary/5"
                  )}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                    {formatDayShort(date)}
                  </p>
                  <p className={cn("text-sm font-semibold tabular-nums", isToday && "text-primary")}>
                    {date.getDate()}
                  </p>
                </div>
                <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-1 sm:p-1.5">
                  {dayAppointments.length === 0 ? (
                    <p className="py-4 text-center text-[10px] text-muted-foreground sm:text-xs">—</p>
                  ) : (
                    <>
                      {dayAppointments.slice(0, MAX_VISIBLE_PER_DAY).map((appt) => {
                        const matchesFilter =
                          !selectedProcedureId ||
                          appt.procedureIds.includes(selectedProcedureId);
                        return (
                          <Link
                            key={appt.id}
                            href={`/dashboard/agenda/consulta/${appt.id}`}
                            className={cn(
                              "block rounded-md border border-border/50 px-1.5 py-1 transition-opacity sm:px-2 sm:py-1.5",
                              getStatusBackgroundColor(appt.status),
                              getStatusTextColor(appt.status),
                              !matchesFilter && "opacity-35"
                            )}
                          >
                            <p className="text-[10px] font-semibold tabular-nums sm:text-xs">
                              {formatTime(appt.scheduled_at)}
                            </p>
                            <p className="truncate text-[10px] font-medium sm:text-xs">
                              {appt.patientName}
                            </p>
                            <p className="truncate text-[9px] opacity-80 sm:text-[10px]">
                              {appt.doctorName}
                            </p>
                          </Link>
                        );
                      })}
                      {dayAppointments.length > MAX_VISIBLE_PER_DAY && (
                        <p className="text-center text-[10px] text-muted-foreground">
                          +{dayAppointments.length - MAX_VISIBLE_PER_DAY} mais
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
