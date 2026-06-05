"use client";

import Link from "next/link";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAppointmentTimeRange } from "@/lib/appointment-scheduling";
import type { WeekLayoutEvent } from "@/lib/agenda-week-layout";
import { AGENDA_SLOT_HEIGHT_PX } from "@/lib/agenda-week-layout";
import type { AppointmentRow } from "./agenda-client";

const EVENT_GAP_PX = 2;

export function WeekCalendarEventBlock({
  appointment,
  layout,
  dayId,
  getAccentColor,
  onEdit,
  onOpenDetails,
  formatTooltip,
}: {
  appointment: AppointmentRow;
  layout: WeekLayoutEvent;
  dayId: string;
  getAccentColor: (appointment: AppointmentRow) => string;
  onEdit?: (appointmentId: string) => void;
  onOpenDetails?: (appointmentId: string) => void;
  formatTooltip: (appointment: AppointmentRow) => string;
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

  const accentColor = getAccentColor(appointment);
  const timeLabel = formatAppointmentTimeRange(
    appointment.scheduled_at,
    appointment.scheduled_end_at
  );
  const procedureNames = (
    appointment.procedures ?? (appointment.procedure ? [appointment.procedure] : [])
  )
    .map((p) => p.name)
    .join(", ");

  const columnWidthPct = 100 / layout.columnCount;
  const leftPct = layout.column * columnWidthPct;
  const showProcedure = layout.heightPx >= 48;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute z-10 overflow-hidden rounded-md border border-border/80 shadow-sm",
        "hover:shadow-md transition-shadow",
        isDragging && "opacity-60 ring-2 ring-primary z-20"
      )}
      style={{
        top: layout.topPx + EVENT_GAP_PX / 2,
        height: Math.max(20, layout.heightPx - EVENT_GAP_PX),
        left: `calc(${leftPct}% + ${EVENT_GAP_PX / 2}px)`,
        width: `calc(${columnWidthPct}% - ${EVENT_GAP_PX}px)`,
        transform: CSS.Transform.toString(transform),
        transition,
        borderLeftWidth: 3,
        borderLeftColor: accentColor,
        backgroundColor: `${accentColor}18`,
      }}
      title={formatTooltip(appointment)}
    >
      <div className="flex h-full min-h-0 flex-col px-1.5 py-1">
        <div className="flex min-h-0 flex-1 items-start gap-0.5">
          <button
            {...attributes}
            {...listeners}
            type="button"
            className="mt-0.5 shrink-0 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onOpenDetails?.(appointment.id)}
          >
            <p className="truncate text-xs font-semibold leading-tight">
              {appointment.patient.full_name}
            </p>
            {showProcedure && procedureNames && (
              <p className="truncate text-[10px] text-muted-foreground leading-tight">
                {procedureNames}
              </p>
            )}
            <p className="truncate text-[10px] tabular-nums text-muted-foreground">
              {timeLabel}
            </p>
          </button>
          <div className="flex shrink-0 flex-col gap-0.5">
            {onEdit && (
              <button
                type="button"
                className="p-0.5 text-muted-foreground hover:text-foreground"
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
            <Link
              href={`/dashboard/agenda/consulta/${appointment.id}`}
              className="p-0.5 text-muted-foreground hover:text-foreground"
              title="Abrir consulta"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekCalendarDropSlot({
  dayId,
  uniqueId,
  slotHour,
  slotMinute,
  topPx,
}: {
  dayId: string;
  uniqueId: string;
  slotHour: number;
  slotMinute: number;
  topPx: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: uniqueId,
    data: {
      type: "day",
      dayId,
      slotHour,
      slotMinute,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute left-0 right-0 z-0",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/40"
      )}
      style={{ top: topPx, height: AGENDA_SLOT_HEIGHT_PX }}
      aria-hidden
    />
  );
}

export function WeekCalendarDayColumn({
  dayId,
  isToday,
  timeSlots,
  gridTotalHeightPx,
  appointments,
  layouts,
  getAccentColor,
  onEditAppointment,
  onOpenDetails,
  formatTooltip,
}: {
  dayId: string;
  isToday: boolean;
  timeSlots: { hour: number; minute: number }[];
  gridTotalHeightPx: number;
  appointments: AppointmentRow[];
  layouts: WeekLayoutEvent[];
  getAccentColor: (appointment: AppointmentRow) => string;
  onEditAppointment?: (appointmentId: string) => void;
  onOpenDetails?: (appointmentId: string) => void;
  formatTooltip: (appointment: AppointmentRow) => string;
}) {
  const appointmentById = new Map(appointments.map((a) => [a.id, a]));

  return (
    <div
      className={cn(
        "relative border-r border-border last:border-r-0",
        isToday && "bg-primary/5"
      )}
      style={{ height: gridTotalHeightPx }}
    >
      {timeSlots.map((slot, slotIndex) => {
        const uniqueDropId = `${dayId}-${slot.hour}-${slot.minute}`;
        return (
          <WeekCalendarDropSlot
            key={uniqueDropId}
            dayId={dayId}
            uniqueId={uniqueDropId}
            slotHour={slot.hour}
            slotMinute={slot.minute}
            topPx={slotIndex * AGENDA_SLOT_HEIGHT_PX}
          />
        );
      })}

      {timeSlots.map((slot, slotIndex) => (
        <div
          key={`line-${slot.hour}-${slot.minute}`}
          className="pointer-events-none absolute left-0 right-0 border-b border-border/60"
          style={{
            top: slotIndex * AGENDA_SLOT_HEIGHT_PX,
            height: AGENDA_SLOT_HEIGHT_PX,
          }}
        />
      ))}

      {layouts.length > 0 && (
        <SortableContext
          items={layouts.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {layouts.map((layout) => {
            const appointment = appointmentById.get(layout.id);
            if (!appointment) return null;
            return (
              <WeekCalendarEventBlock
                key={appointment.id}
                appointment={appointment}
                layout={layout}
                dayId={dayId}
                getAccentColor={getAccentColor}
                onEdit={onEditAppointment}
                onOpenDetails={onOpenDetails}
                formatTooltip={formatTooltip}
              />
            );
          })}
        </SortableContext>
      )}
    </div>
  );
}
