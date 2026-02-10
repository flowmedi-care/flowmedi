"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  updateNextAction,
  registerPatientFromPipeline,
  removeFromPipelineOnAppointment,
  type PipelineItem,
  type PipelineStage,
} from "./actions";
import {
  List,
  LayoutGrid,
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  UserPlus,
  Archive,
  CheckCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

const STAGE_LABELS: Record<PipelineStage, string> = {
  novo_contato: "Novo Contato",
  aguardando_retorno: "Aguardando Retorno",
  cadastrado: "Cadastrado",
  agendado: "Agendado",
};

const STAGE_COLORS: Record<PipelineStage, string> = {
  novo_contato: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  aguardando_retorno: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  cadastrado: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  agendado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

type ViewMode = "list" | "kanban";

export function PipelineClient({ initialItems }: { initialItems: PipelineItem[] }) {
  const [items, setItems] = useState<PipelineItem[]>(initialItems);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
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

    // Otimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, stage: newStage } : i))
    );

    // Update on server
    const result = await changePipelineStage(itemId, newStage);
    if (result.error) {
      // Revert on error
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
    const result = await registerPatientFromPipeline(item.id);
    if (result.error) {
      toast(`Erro ao cadastrar: ${result.error}`, "error");
    } else {
      toast("Paciente cadastrado com sucesso", "success");
      router.refresh();
    }
  };

  const handleScheduleAppointment = (item: PipelineItem) => {
    // Redirecionar para agenda com paciente pré-selecionado via email
    // A agenda vai buscar o paciente pelo email se necessário
    router.push(`/dashboard/agenda?new=true&patientEmail=${encodeURIComponent(item.email)}`);
  };

  const stages: PipelineStage[] = [
    "novo_contato",
    "aguardando_retorno",
    "cadastrado",
    "agendado",
  ];

  const itemsByStage = stages.reduce((acc, stage) => {
    acc[stage] = items.filter((item) => item.stage === stage);
    return acc;
  }, {} as Record<PipelineStage, PipelineItem[]>);

  const ViewToggleButtons = () => (
    <div className="flex gap-2">
      <Button
        variant={viewMode === "list" ? "default" : "outline"}
        size="sm"
        onClick={() => setViewMode("list")}
      >
        <List className="h-4 w-4 mr-2" />
        Lista
      </Button>
      <Button
        variant={viewMode === "kanban" ? "default" : "outline"}
        size="sm"
        onClick={() => setViewMode("kanban")}
      >
        <LayoutGrid className="h-4 w-4 mr-2" />
        Kanban
      </Button>
    </div>
  );

  if (viewMode === "list") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Não Cadastrados</h2>
          <ViewToggleButtons />
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <PipelineListItem
              key={item.id}
              item={item}
              onSelect={() => {
                setSelectedItem(item);
                setShowNoteDialog(true);
              }}
              onChangeStage={handleChangeStage}
              onRegister={handleRegisterPatient}
              onSchedule={handleScheduleAppointment}
            />
          ))}
        </div>

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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Não Cadastrados</h2>
        <ViewToggleButtons />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              items={itemsByStage[stage]}
              onSelectItem={(item) => {
                setSelectedItem(item);
                setShowNoteDialog(true);
              }}
              onChangeStage={handleChangeStage}
              onRegister={handleRegisterPatient}
              onSchedule={handleScheduleAppointment}
            />
          ))}
        </div>

        <DragOverlay>
          {activeId ? (
            <PipelineCard
              item={items.find((i) => i.id === activeId)!}
              isDragging
              onRegister={handleRegisterPatient}
              onSchedule={handleScheduleAppointment}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

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
    </div>
  );
}

function KanbanColumn({
  stage,
  items,
  onSelectItem,
  onChangeStage,
  onRegister,
  onSchedule,
}: {
  stage: PipelineStage;
  items: PipelineItem[];
  onSelectItem: (item: PipelineItem) => void;
  onChangeStage: (itemId: string, newStage: PipelineStage) => void;
  onRegister?: (item: PipelineItem) => void;
  onSchedule?: (item: PipelineItem) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: stage,
  });
  const itemIds = items.map((item) => item.id);

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center justify-between p-2">
        <h3 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h3>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[200px] rounded-lg border-2 border-dashed p-2 space-y-2",
          items.length === 0 && "border-gray-300 dark:border-gray-700"
        )}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortablePipelineCard
              key={item.id}
              item={item}
              onSelect={() => onSelectItem(item)}
              onChangeStage={onChangeStage}
              onRegister={onRegister}
              onSchedule={onSchedule}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function SortablePipelineCard({
  item,
  onSelect,
  onChangeStage,
  onRegister,
  onSchedule,
}: {
  item: PipelineItem;
  onSelect: () => void;
  onChangeStage: (itemId: string, newStage: PipelineStage) => void;
  onRegister?: (item: PipelineItem) => void;
  onSchedule?: (item: PipelineItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PipelineCard
        item={item}
        isDragging={isDragging}
        onSelect={onSelect}
        onChangeStage={onChangeStage}
        onRegister={onRegister}
        onSchedule={onSchedule}
      />
    </div>
  );
}

function PipelineCard({
  item,
  isDragging = false,
  onSelect,
  onChangeStage,
  onRegister,
  onSchedule,
}: {
  item: PipelineItem;
  isDragging?: boolean;
  onSelect?: () => void;
  onChangeStage?: (itemId: string, newStage: PipelineStage) => void;
  onRegister?: (item: PipelineItem) => void;
  onSchedule?: (item: PipelineItem) => void;
}) {
  return (
    <Card
      className={cn(
        "hover:shadow-md transition-shadow",
        isDragging && "opacity-50"
      )}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onSelect}>
            <p className="text-sm font-medium truncate">
              {item.name || "Sem nome"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{item.email}</p>
          </div>
        </div>
        {item.phone && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            {item.phone}
          </div>
        )}
        {item.forms.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {item.forms.length} formulário{item.forms.length > 1 ? "s" : ""}
          </Badge>
        )}
        {item.next_action && (
          <p className="text-xs text-muted-foreground italic">
            Próxima: {item.next_action}
          </p>
        )}
        {/* Botões de ação por etapa */}
        {item.stage === "aguardando_retorno" && onRegister && (
          <Button
            size="sm"
            className="w-full mt-2"
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
            className="w-full mt-2"
            onClick={(e) => {
              e.stopPropagation();
              onSchedule(item);
            }}
          >
            <Calendar className="h-3 w-3 mr-1" />
            Agendar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PipelineListItem({
  item,
  onSelect,
  onChangeStage,
  onRegister,
  onSchedule,
}: {
  item: PipelineItem;
  onSelect: () => void;
  onChangeStage: (itemId: string, newStage: PipelineStage) => void;
  onRegister?: (item: PipelineItem) => void;
  onSchedule?: (item: PipelineItem) => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium">
                {item.name || "Sem nome"}
              </p>
              <Badge className={STAGE_COLORS[item.stage]}>
                {STAGE_LABELS[item.stage]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{item.email}</p>
            {item.phone && (
              <p className="text-xs text-muted-foreground">{item.phone}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onSelect}>
              <MessageSquare className="h-4 w-4" />
            </Button>
            {item.stage === "aguardando_retorno" && onRegister && (
              <Button
                size="sm"
                onClick={() => onRegister(item)}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Cadastrar
              </Button>
            )}
            {item.stage === "cadastrado" && onSchedule && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSchedule(item)}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Agendar
              </Button>
            )}
            <select
              value={item.stage}
              onChange={(e) => onChangeStage(item.id, e.target.value as PipelineStage)}
              className="text-xs border rounded px-2 py-1"
            >
              {Object.entries(STAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

