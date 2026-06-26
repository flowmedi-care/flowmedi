"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Calendar, Stethoscope, ChevronRight } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { FilterBar } from "@/components/dashboard-ui/layout/filter-bar";
import { KanbanColumnShell } from "@/components/dashboard-ui/kanban/kanban-column";
import { KanbanCardShell } from "@/components/dashboard-ui/kanban/kanban-card";
import { KanbanEmptyColumn } from "@/components/dashboard-ui/kanban/kanban-empty-column";
import {
  APPOINTMENT_PIPELINE_STAGE_ACCENT,
  APPOINTMENT_PIPELINE_STAGE_BADGE_VARIANT,
  APPOINTMENT_PIPELINE_STAGE_LABELS,
  APPOINTMENT_PIPELINE_STAGES,
  APPOINTMENT_PIPELINE_FLOW_STAGES,
  APPOINTMENT_PIPELINE_OUTCOME_STAGES,
} from "@/components/dashboard-ui/kanban/appointment-pipeline-stage-colors";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import {
  changeAppointmentPipelineStatus,
  type AppointmentPipelineItem,
  type AppointmentPipelineStatus,
} from "./pipeline-actions";

export function AppointmentPipelineClient({
  initialItems,
}: {
  initialItems: AppointmentPipelineItem[];
}) {
  const [items, setItems] = useState<AppointmentPipelineItem[]>(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const doctors = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.doctor_id && item.doctor_name) {
        map.set(item.doctor_id, item.doctor_name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !search.trim() ||
        item.patient_name.toLowerCase().includes(search.toLowerCase());
      const matchesDoctor =
        doctorFilter === "all" || item.doctor_id === doctorFilter;
      return matchesSearch && matchesDoctor;
    });
  }, [items, search, doctorFilter]);

  const itemsByStatus = APPOINTMENT_PIPELINE_STAGES.reduce(
    (acc, status) => {
      acc[status] = filteredItems.filter((item) => item.status === status);
      return acc;
    },
    {} as Record<AppointmentPipelineStatus, AppointmentPipelineItem[]>
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const itemId = active.id as string;
    const newStatus = over.id as AppointmentPipelineStatus;
    const item = items.find((i) => i.id === itemId);
    if (!item || item.status === newStatus) return;
    if (!APPOINTMENT_PIPELINE_STAGES.includes(newStatus)) return;

    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, status: newStatus } : i))
    );

    const result = await changeAppointmentPipelineStatus(itemId, newStatus);
    if (result.error) {
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, status: item.status } : i))
      );
      toast(`Erro ao mover: ${result.error}`, "error");
    } else {
      toast("Status atualizado com sucesso", "success");
      router.refresh();
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const toolbar = (
    <div className="flex w-full justify-center">
      <div className="w-full max-w-sm">
        <FilterBar
          filters={
            <div className="flex flex-wrap items-center justify-center gap-2 w-full">
              <Input
                placeholder="Buscar paciente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full"
              />
              {doctors.length > 1 && (
                <select
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Todos os profissionais</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          }
        />
      </div>
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="space-y-4 w-full">
        {toolbar}
        <div className="flex justify-center">
          <EmptyState
            title="Nenhuma consulta no pipeline"
            description="Consultas agendadas aparecerão aqui após o agendamento."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {toolbar}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex w-full justify-center overflow-x-auto pb-2 px-1">
          <div className="inline-flex items-start gap-3">
          {APPOINTMENT_PIPELINE_FLOW_STAGES.map((status) => (
            <AppointmentKanbanColumn
              key={status}
              status={status}
              items={itemsByStatus[status]}
              formatDateTime={formatDateTime}
            />
          ))}

          <div className="flex shrink-0 items-center self-center pt-20 text-muted-foreground/60">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </div>

          <div className="flex shrink-0 flex-col gap-3 pt-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-1">
              Desfecho
            </p>
            {APPOINTMENT_PIPELINE_OUTCOME_STAGES.map((status) => (
              <AppointmentKanbanColumn
                key={status}
                status={status}
                items={itemsByStatus[status]}
                formatDateTime={formatDateTime}
                compact
              />
            ))}
          </div>
        </div>
        </div>

        <DragOverlay>
          {activeId ? (
            <AppointmentCardContent
              item={items.find((i) => i.id === activeId)!}
              isDragging
              formatDateTime={formatDateTime}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function AppointmentKanbanColumn({
  status,
  items,
  formatDateTime,
  compact = false,
}: {
  status: AppointmentPipelineStatus;
  items: AppointmentPipelineItem[];
  formatDateTime: (iso: string) => { date: string; time: string };
  compact?: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: status });
  const itemIds = items.map((item) => item.id);

  return (
    <KanbanColumnShell
      title={APPOINTMENT_PIPELINE_STAGE_LABELS[status]}
      count={items.length}
      accentClassName={APPOINTMENT_PIPELINE_STAGE_ACCENT[status]}
      bodyRef={setNodeRef}
      bodyClassName={compact ? "min-h-[120px] sm:min-h-[130px]" : undefined}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {items.length === 0 ? (
          <KanbanEmptyColumn />
        ) : (
          items.map((item) => (
            <SortableAppointmentCard
              key={item.id}
              item={item}
              formatDateTime={formatDateTime}
            />
          ))
        )}
      </SortableContext>
    </KanbanColumnShell>
  );
}

function SortableAppointmentCard({
  item,
  formatDateTime,
}: {
  item: AppointmentPipelineItem;
  formatDateTime: (iso: string) => { date: string; time: string };
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      <AppointmentCardContent
        item={item}
        isDragging={isDragging}
        formatDateTime={formatDateTime}
      />
    </div>
  );
}

function AppointmentCardContent({
  item,
  isDragging = false,
  formatDateTime,
}: {
  item: AppointmentPipelineItem;
  isDragging?: boolean;
  formatDateTime: (iso: string) => { date: string; time: string };
}) {
  const { date, time } = formatDateTime(item.scheduled_at);

  return (
    <KanbanCardShell isDragging={isDragging}>
      <div className="space-y-1">
        <p className="text-sm font-medium truncate">{item.patient_name}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>
            {date} às {time}
          </span>
        </div>
        {item.doctor_name && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Stethoscope className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.doctor_name}</span>
          </div>
        )}
      </div>
      <Badge variant={APPOINTMENT_PIPELINE_STAGE_BADGE_VARIANT[item.status]} className="text-xs w-fit">
        {APPOINTMENT_PIPELINE_STAGE_LABELS[item.status]}
      </Badge>
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        asChild
        onClick={(e) => e.stopPropagation()}
      >
        <Link href={`/dashboard/agenda/consulta/${item.id}`}>Abrir consulta</Link>
      </Button>
    </KanbanCardShell>
  );
}
