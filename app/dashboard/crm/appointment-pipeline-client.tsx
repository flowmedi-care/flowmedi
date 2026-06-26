"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { ListPanel, ListPanelItem } from "@/components/dashboard-ui/list-panel";
import type { CrmPipelineViewMode } from "./crm-pipeline-boards-client";
import {
  changeAppointmentPipelineStatus,
  type AppointmentPipelineItem,
  type AppointmentPipelineStatus,
} from "./pipeline-actions";

export function AppointmentPipelineClient({
  initialItems,
  viewMode = "kanban",
}: {
  initialItems: AppointmentPipelineItem[];
  viewMode?: CrmPipelineViewMode;
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

    await handleChangeStatus(itemId, newStatus, item.status);
  };

  const handleChangeStatus = async (
    itemId: string,
    newStatus: AppointmentPipelineStatus,
    previousStatus?: AppointmentPipelineStatus
  ) => {
    const prev =
      previousStatus ?? items.find((i) => i.id === itemId)?.status ?? "agendada";

    setItems((prevItems) =>
      prevItems.map((i) => (i.id === itemId ? { ...i, status: newStatus } : i))
    );

    const result = await changeAppointmentPipelineStatus(itemId, newStatus);
    if (result.error) {
      setItems((prevItems) =>
        prevItems.map((i) => (i.id === itemId ? { ...i, status: prev } : i))
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

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Buscar paciente..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-full sm:w-48"
      />
      {doctors.length > 1 && (
        <select
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
  );

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <FilterBar filters={filters} />
        <EmptyState
          title="Nenhuma consulta no pipeline"
          description="Consultas agendadas aparecerão aqui após o agendamento."
        />
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="space-y-4">
        <FilterBar filters={filters} />
        {filteredItems.length === 0 ? (
          <EmptyState
            title="Nenhum resultado"
            description="Nenhuma consulta corresponde aos filtros."
          />
        ) : (
          <ListPanel>
            {filteredItems.map((item) => (
              <ListPanelItem key={item.id}>
                <AppointmentListItem
                  item={item}
                  formatDateTime={formatDateTime}
                  onChangeStatus={handleChangeStatus}
                />
              </ListPanelItem>
            ))}
          </ListPanel>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar filters={filters} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="w-full min-w-0 pb-2">
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex shrink-0 items-center gap-3">
              {APPOINTMENT_PIPELINE_FLOW_STAGES.map((status) => (
                <AppointmentKanbanColumn
                  key={status}
                  status={status}
                  items={itemsByStatus[status]}
                  formatDateTime={formatDateTime}
                />
              ))}
            </div>

            <ChevronRight
              className="h-5 w-5 shrink-0 text-muted-foreground/60"
              aria-hidden
            />

            <div className="flex shrink-0 flex-col justify-center gap-3">
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
      <Badge
        variant={APPOINTMENT_PIPELINE_STAGE_BADGE_VARIANT[item.status]}
        className="text-xs w-fit"
      >
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

function AppointmentListItem({
  item,
  formatDateTime,
  onChangeStatus,
}: {
  item: AppointmentPipelineItem;
  formatDateTime: (iso: string) => { date: string; time: string };
  onChangeStatus: (
    itemId: string,
    newStatus: AppointmentPipelineStatus
  ) => Promise<void>;
}) {
  const { date, time } = formatDateTime(item.scheduled_at);

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{item.patient_name}</p>
          <Badge variant={APPOINTMENT_PIPELINE_STAGE_BADGE_VARIANT[item.status]}>
            {APPOINTMENT_PIPELINE_STAGE_LABELS[item.status]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {date} às {time}
          {item.doctor_name ? ` • ${item.doctor_name}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link href={`/dashboard/agenda/consulta/${item.id}`}>Abrir consulta</Link>
        </Button>
        <Select
          value={item.status}
          onChange={(e) =>
            onChangeStatus(item.id, e.target.value as AppointmentPipelineStatus)
          }
          className="h-8 w-auto min-w-[140px] text-xs"
        >
          {APPOINTMENT_PIPELINE_STAGES.map((status) => (
            <option key={status} value={status}>
              {APPOINTMENT_PIPELINE_STAGE_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
