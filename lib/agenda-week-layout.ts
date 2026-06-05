/** Geometria e colunas para a grade semanal proporcional à duração. */

import { DEFAULT_APPOINTMENT_DURATION_MINUTES } from "@/lib/appointment-scheduling";

export const AGENDA_SLOT_HEIGHT_PX = 36;
export const AGENDA_SLOT_STEP_MINUTES = 15;

export type WeekLayoutInput = {
  id: string;
  scheduledAt: string;
  scheduledEndAt: string | null | undefined;
};

export type WeekLayoutRect = {
  id: string;
  topPx: number;
  heightPx: number;
  startMin: number;
  endMin: number;
};

export type WeekLayoutEvent = WeekLayoutRect & {
  column: number;
  columnCount: number;
};

function minutesFromDate(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function resolveEndMin(
  scheduledAt: string,
  scheduledEndAt: string | null | undefined
): number {
  if (scheduledEndAt) {
    return minutesFromDate(scheduledEndAt);
  }
  return minutesFromDate(scheduledAt) + DEFAULT_APPOINTMENT_DURATION_MINUTES;
}

/** Minutos desde meia-noite do início da grade (primeiro slot). */
export function getGridBounds(
  gridStartHour: number,
  gridEndHour: number,
  stepMinutes = AGENDA_SLOT_STEP_MINUTES
): { gridStartMin: number; gridEndMin: number } {
  return {
    gridStartMin: gridStartHour * 60,
    gridEndMin: gridEndHour * 60 + stepMinutes,
  };
}

export function getGridTotalHeightPx(slotCount: number): number {
  return slotCount * AGENDA_SLOT_HEIGHT_PX;
}

export function getAppointmentRect(
  scheduledAt: string,
  scheduledEndAt: string | null | undefined,
  gridStartHour: number,
  gridEndHour: number,
  stepMinutes = AGENDA_SLOT_STEP_MINUTES,
  slotHeightPx = AGENDA_SLOT_HEIGHT_PX
): WeekLayoutRect {
  const { gridStartMin, gridEndMin } = getGridBounds(
    gridStartHour,
    gridEndHour,
    stepMinutes
  );

  let startMin = minutesFromDate(scheduledAt);
  let endMin = resolveEndMin(scheduledAt, scheduledEndAt);

  if (endMin <= startMin) {
    endMin = startMin + stepMinutes;
  }

  const visibleStart = Math.max(startMin, gridStartMin);
  const visibleEnd = Math.min(endMin, gridEndMin);

  if (visibleEnd <= visibleStart) {
    return {
      id: scheduledAt,
      topPx: 0,
      heightPx: 0,
      startMin,
      endMin,
    };
  }

  const durationMin = Math.max(stepMinutes, visibleEnd - visibleStart);

  const topPx =
    ((visibleStart - gridStartMin) / stepMinutes) * slotHeightPx;
  const heightPx = Math.max(
    slotHeightPx,
    (durationMin / stepMinutes) * slotHeightPx
  );

  return {
    id: scheduledAt,
    topPx,
    heightPx,
    startMin,
    endMin,
  };
}

function assignClusterColumns(
  cluster: WeekLayoutRect[]
): Map<string, { column: number; columnCount: number }> {
  const sorted = [...cluster].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin
  );

  const columnEnds: number[] = [];
  const columnById = new Map<string, number>();

  for (const event of sorted) {
    let column = columnEnds.findIndex((end) => end <= event.startMin);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(event.endMin);
    } else {
      columnEnds[column] = event.endMin;
    }
    columnById.set(event.id, column);
  }

  const columnCount = Math.max(1, columnEnds.length);
  const result = new Map<string, { column: number; columnCount: number }>();
  for (const event of cluster) {
    result.set(event.id, {
      column: columnById.get(event.id) ?? 0,
      columnCount,
    });
  }
  return result;
}

/** Agrupa consultas sobrepostas e distribui colunas lado a lado. */
export function layoutOverlappingEvents(
  items: WeekLayoutInput[],
  gridStartHour: number,
  gridEndHour: number,
  stepMinutes = AGENDA_SLOT_STEP_MINUTES,
  slotHeightPx = AGENDA_SLOT_HEIGHT_PX
): WeekLayoutEvent[] {
  const rects: WeekLayoutRect[] = items
    .map((item) => {
      const rect = getAppointmentRect(
        item.scheduledAt,
        item.scheduledEndAt,
        gridStartHour,
        gridEndHour,
        stepMinutes,
        slotHeightPx
      );
      return { ...rect, id: item.id };
    })
    .filter((rect) => rect.heightPx > 0);

  const sorted = [...rects].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin
  );

  const clusters: WeekLayoutRect[][] = [];
  let cluster: WeekLayoutRect[] = [];
  let clusterEnd = -Infinity;

  for (const rect of sorted) {
    if (cluster.length === 0 || rect.startMin < clusterEnd) {
      cluster.push(rect);
      clusterEnd = Math.max(clusterEnd, rect.endMin);
    } else {
      clusters.push(cluster);
      cluster = [rect];
      clusterEnd = rect.endMin;
    }
  }
  if (cluster.length > 0) clusters.push(cluster);

  const layoutById = new Map<string, { column: number; columnCount: number }>();
  for (const group of clusters) {
    const assignments = assignClusterColumns(group);
    assignments.forEach((value, id) => layoutById.set(id, value));
  }

  return rects.map((rect) => {
    const placement = layoutById.get(rect.id) ?? { column: 0, columnCount: 1 };
    return {
      ...rect,
      column: placement.column,
      columnCount: placement.columnCount,
    };
  });
}
