"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  changePipelineStage,
  addPipelineNote,
  registerPatientFromPipeline,
  markPipelineAsCompleted,
  type PipelineItem,
  type PipelineStage,
} from "./actions";
import {
  List,
  LayoutGrid,
  MessageSquare,
  Phone,
  Calendar,
  UserPlus,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhoneBr } from "@/lib/format-phone";
import { toast } from "@/components/ui/toast";
import { FilterBar } from "@/components/dashboard-ui/layout/filter-bar";
import { ViewModeToggle } from "@/components/dashboard-ui/layout/view-mode-toggle";
import { KanbanBoard } from "@/components/dashboard-ui/kanban/kanban-board";
import { KanbanColumnShell } from "@/components/dashboard-ui/kanban/kanban-column";
import { KanbanCardShell } from "@/components/dashboard-ui/kanban/kanban-card";
import { KanbanEmptyColumn } from "@/components/dashboard-ui/kanban/kanban-empty-column";
import {
  PIPELINE_STAGE_ACCENT,
  PIPELINE_STAGE_BADGE_VARIANT,
  PIPELINE_STAGE_LABELS,
} from "@/components/dashboard-ui/kanban/pipeline-stage-colors";
import { ListPanel, ListPanelItem } from "@/components/dashboard-ui/list-panel";
import { EmptyState } from "@/components/dashboard-ui/empty-state";

type ViewMode = "list" | "kanban";

export function PipelineClient({
  initialItems,
  embedded = false,
}: {
  initialItems: PipelineItem[];
  embedded?: boolean;
}) {
  const [items, setItems] = useState<PipelineItem[]>(initialItems);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const itemId = active.id as string;
    const newStage = over.id as PipelineStage;
    const item = items.find((i) => i.id === itemId);
    if (!item || item.stage === newStage) return;

    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, stage: newStage } : i))
    );

    const result = await changePipelineStage(itemId, newStage);
    if (result.error) {
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, stage: item.stage } : i))
      );
      toast(`Erro ao mover: ${result.error}`, "error");
    } else {
      toast("Etapa atualizada com sucesso", "success");
      router.refresh();
    }
  };

  const handleAddNote = async () => {
    if (!selectedItem || !noteText.trim()) return;
    const result = await addPipelineNote(selectedItem.id, noteText);
    if (result.error) {
      toast(`Erro: ${result.error}`, "error");
    } else {
      toast("Nota adicionada com sucesso", "success");
      setShowNoteDialog(false);
      setNoteText("");
      setSelectedItem(null);
      router.refresh();
    }
  };

  const handleChangeStage = async (itemId: string, newStage: PipelineStage) => {
    const result = await changePipelineStage(itemId, newStage);
    if (result.error) {
      toast(`Erro: ${result.error}`, "error");
    } else {
      toast("Etapa atualizada com sucesso", "success");
      router.refresh();
    }
  };

  const handleRegisterPatient = async (item: PipelineItem) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, stage: "cadastrado" as PipelineStage } : i
      )
    );
    const result = await registerPatientFromPipeline(item.id);
    if (result.error) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, stage: item.stage } : i))
      );
      toast(`Erro ao cadastrar: ${result.error}`, "error");
    } else {
      toast("Paciente cadastrado com sucesso", "success");
      router.refresh();
    }
  };

  const handleScheduleAppointment = (item: PipelineItem) => {
    router.push(
      `/dashboard/agenda?new=true&patientEmail=${encodeURIComponent(item.email)}`
    );
  };

  const handleMarkAsCompleted = async (item: PipelineItem) => {
    const result = await markPipelineAsCompleted(item.id);
    if (result.error) {
      toast(`Erro: ${result.error}`, "error");
    } else {
      toast("Marcado como concluído", "success");
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      router.refresh();
    }
  };

  const stages: PipelineStage[] = [
    "novo_contato",
    "aguardando_retorno",
    "cadastrado",
    "agendado",
  ];

  const itemsByStage = stages.reduce(
    (acc, stage) => {
      acc[stage] = items.filter((item) => item.stage === stage);
      return acc;
    },
    {} as Record<PipelineStage, PipelineItem[]>
  );

  const noteDialog = (
    <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
      <DialogContent title="Adicionar Nota">
        {selectedItem && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">
                {selectedItem.name || selectedItem.email}
              </p>
              <p className="text-xs text-muted-foreground">{selectedItem.email}</p>
            </div>
            <Textarea
              placeholder="Digite sua nota..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddNote}>Salvar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  const toolbar = (
    <FilterBar
      actions={
        <ViewModeToggle
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: "list", label: "Lista", icon: List },
            { value: "kanban", label: "Kanban", icon: LayoutGrid },
          ]}
        />
      }
    />
  );

  if (viewMode === "list") {
    return (
      <div className="space-y-4">
        {!embedded && toolbar}
        {items.length === 0 ? (
          <EmptyState title="Nenhum lead no pipeline" description="Novos contatos aparecerão aqui." />
        ) : (
          <ListPanel>
            {items.map((item) => (
              <ListPanelItem key={item.id}>
                <PipelineListItem
                  item={item}
                  onSelect={() => {
                    setSelectedItem(item);
                    setShowNoteDialog(true);
                  }}
                  onChangeStage={handleChangeStage}
                  onRegister={handleRegisterPatient}
                  onSchedule={handleScheduleAppointment}
                  onMarkAsCompleted={handleMarkAsCompleted}
                />
              </ListPanelItem>
            ))}
          </ListPanel>
        )}
        {noteDialog}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!embedded && toolbar}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <KanbanBoard>
          {stages.map((stage) => (
            <PipelineKanbanColumn
              key={stage}
              stage={stage}
              items={itemsByStage[stage]}
              onSelectItem={(item) => {
                setSelectedItem(item);
                setShowNoteDialog(true);
              }}
              onRegister={handleRegisterPatient}
              onSchedule={handleScheduleAppointment}
              onMarkAsCompleted={handleMarkAsCompleted}
            />
          ))}
        </KanbanBoard>

        <DragOverlay>
          {activeId ? (
            <PipelineCardContent
              item={items.find((i) => i.id === activeId)!}
              isDragging
              onRegister={handleRegisterPatient}
              onSchedule={handleScheduleAppointment}
              onMarkAsCompleted={handleMarkAsCompleted}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {noteDialog}
    </div>
  );
}

function PipelineKanbanColumn({
  stage,
  items,
  onSelectItem,
  onRegister,
  onSchedule,
  onMarkAsCompleted,
}: {
  stage: PipelineStage;
  items: PipelineItem[];
  onSelectItem: (item: PipelineItem) => void;
  onRegister?: (item: PipelineItem) => void;
  onSchedule?: (item: PipelineItem) => void;
  onMarkAsCompleted?: (item: PipelineItem) => void;
}) {
  const { setNodeRef } = useDroppable({ id: stage });
  const itemIds = items.map((item) => item.id);

  return (
    <KanbanColumnShell
      title={PIPELINE_STAGE_LABELS[stage]}
      count={items.length}
      accentClassName={PIPELINE_STAGE_ACCENT[stage]}
      bodyRef={setNodeRef}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {items.length === 0 ? (
          <KanbanEmptyColumn />
        ) : (
          items.map((item) => (
            <SortablePipelineCard
              key={item.id}
              item={item}
              onSelect={() => onSelectItem(item)}
              onRegister={onRegister}
              onSchedule={onSchedule}
              onMarkAsCompleted={onMarkAsCompleted}
            />
          ))
        )}
      </SortableContext>
    </KanbanColumnShell>
  );
}

function SortablePipelineCard({
  item,
  onSelect,
  onRegister,
  onSchedule,
  onMarkAsCompleted,
}: {
  item: PipelineItem;
  onSelect: () => void;
  onRegister?: (item: PipelineItem) => void;
  onSchedule?: (item: PipelineItem) => void;
  onMarkAsCompleted?: (item: PipelineItem) => void;
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
      <PipelineCardContent
        item={item}
        isDragging={isDragging}
        onSelect={onSelect}
        onRegister={onRegister}
        onSchedule={onSchedule}
        onMarkAsCompleted={onMarkAsCompleted}
      />
    </div>
  );
}

function PipelineCardContent({
  item,
  isDragging = false,
  onSelect,
  onRegister,
  onSchedule,
  onMarkAsCompleted,
}: {
  item: PipelineItem;
  isDragging?: boolean;
  onSelect?: () => void;
  onRegister?: (item: PipelineItem) => void;
  onSchedule?: (item: PipelineItem) => void;
  onMarkAsCompleted?: (item: PipelineItem) => void;
}) {
  return (
    <KanbanCardShell isDragging={isDragging}>
      <div className="cursor-pointer" onClick={onSelect}>
        <p className="text-sm font-medium truncate">{item.name || "Sem nome"}</p>
        <p className="text-xs text-muted-foreground truncate">{item.email}</p>
      </div>
      {item.phone && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" />
          <span>{formatPhoneBr(item.phone)}</span>
        </div>
      )}
      {item.forms.length > 0 && (
        <Badge variant="outline" className="text-xs">
          {item.forms.length} formulário{item.forms.length > 1 ? "s" : ""}
        </Badge>
      )}
      {item.next_action && (
        <p className="text-xs text-muted-foreground italic">Próxima: {item.next_action}</p>
      )}
      {item.stage === "aguardando_retorno" && onRegister && (
        <Button
          size="sm"
          variant="soft"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onRegister(item);
          }}
        >
          <UserPlus className="h-3 w-3 mr-1" />
          Cadastrar
        </Button>
      )}
      {item.stage === "cadastrado" && onSchedule && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onSchedule(item);
          }}
        >
          <Calendar className="h-3 w-3 mr-1" />
          Agendar
        </Button>
      )}
      {item.stage === "agendado" && onMarkAsCompleted && (
        <Button
          size="sm"
          variant="soft"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsCompleted(item);
          }}
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Concluir
        </Button>
      )}
    </KanbanCardShell>
  );
}

function PipelineListItem({
  item,
  onSelect,
  onChangeStage,
  onRegister,
  onSchedule,
  onMarkAsCompleted,
}: {
  item: PipelineItem;
  onSelect: () => void;
  onChangeStage: (itemId: string, newStage: PipelineStage) => void;
  onRegister?: (item: PipelineItem) => void;
  onSchedule?: (item: PipelineItem) => void;
  onMarkAsCompleted?: (item: PipelineItem) => void;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="text-sm font-medium">{item.name || "Sem nome"}</p>
          <Badge variant={PIPELINE_STAGE_BADGE_VARIANT[item.stage]}>
            {PIPELINE_STAGE_LABELS[item.stage]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{item.email}</p>
        {item.phone && (
          <p className="text-xs text-muted-foreground">{formatPhoneBr(item.phone)}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        <Button variant="outline" size="sm" onClick={onSelect}>
          <MessageSquare className="h-4 w-4" />
        </Button>
        {item.stage === "aguardando_retorno" && onRegister && (
          <Button size="sm" variant="soft" onClick={() => onRegister(item)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Cadastrar
          </Button>
        )}
        {item.stage === "cadastrado" && onSchedule && (
          <Button size="sm" variant="outline" onClick={() => onSchedule(item)}>
            <Calendar className="h-4 w-4 mr-1" />
            Agendar
          </Button>
        )}
        {item.stage === "agendado" && onMarkAsCompleted && (
          <Button size="sm" variant="soft" onClick={() => onMarkAsCompleted(item)}>
            <CheckCircle className="h-4 w-4 mr-1" />
            Concluir
          </Button>
        )}
        <Select
          value={item.stage}
          onChange={(e) => onChangeStage(item.id, e.target.value as PipelineStage)}
          className="h-8 w-auto min-w-[140px] text-xs"
        >
          {Object.entries(PIPELINE_STAGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
