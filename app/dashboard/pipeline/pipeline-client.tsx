"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  changeLifecycleStage,
  addPipelineNote,
  registerPatientFromPipeline,
  registerPipelineContact,
  qualifyPipelineLead,
  markPipelineAsLost,
  type PipelineItem,
} from "./actions";
import type { LifecycleStage } from "@/lib/leads/lifecycle";
import {
  getEffectiveLifecycleStage,
  LIFECYCLE_STAGES,
  lifecycleToLegacyStage,
} from "@/lib/leads/lifecycle";
import {
  computePipelineItemScore,
  TEMPERATURE_LABELS,
  type LeadTemperature,
} from "@/lib/leads/scoring";
import { LOSS_REASONS } from "@/lib/leads/loss-reasons";
import { LEAD_SOURCE_LABELS } from "@/lib/leads/lifecycle";
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
import { KanbanShell } from "@/components/kanban";
import { KanbanCardShell } from "@/components/dashboard-ui/kanban/kanban-card";
import {
  LIFECYCLE_STAGE_ACCENT,
  LIFECYCLE_STAGE_BADGE_VARIANT,
  LIFECYCLE_STAGE_LABELS,
} from "@/components/dashboard-ui/kanban/lifecycle-stage-colors";
import { ListPanel, ListPanelItem } from "@/components/dashboard-ui/list-panel";
import { EmptyState } from "@/components/dashboard-ui/empty-state";

type ViewMode = "list" | "kanban";

export function PipelineClient({
  initialItems,
  embedded = false,
  viewMode: controlledViewMode,
  onViewModeChange,
}: {
  initialItems: PipelineItem[];
  embedded?: boolean;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}) {
  const [items, setItems] = useState<PipelineItem[]>(initialItems);
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>("kanban");
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showLossDialog, setShowLossDialog] = useState(false);
  const [lossReason, setLossReason] = useState("");
  const [pendingLifecycle, setPendingLifecycle] = useState<{
    itemId: string;
    lifecycle: LifecycleStage;
    previousLifecycle: LifecycleStage;
  } | null>(null);
  const router = useRouter();

  const getItemLifecycle = (item: PipelineItem) => getEffectiveLifecycleStage(item);

  const moveToLifecycle = async (itemId: string, newLifecycle: LifecycleStage) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const currentLifecycle = getItemLifecycle(item);
    if (currentLifecycle === newLifecycle) return;

    if (newLifecycle === "perdido") {
      setPendingLifecycle({ itemId, lifecycle: newLifecycle, previousLifecycle: currentLifecycle });
      setShowLossDialog(true);
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              lifecycle_stage: newLifecycle,
              stage: lifecycleToLegacyStage(newLifecycle),
              loss_reason: null,
            }
          : i
      )
    );

    const result = await changeLifecycleStage(itemId, newLifecycle);
    if (result.error) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                lifecycle_stage: currentLifecycle,
                stage: lifecycleToLegacyStage(currentLifecycle),
              }
            : i
        )
      );
      toast(`Erro ao mover: ${result.error}`, "error");
    } else {
      toast("Etapa atualizada com sucesso", "success");
      router.refresh();
    }
  };

  const handleConfirmLoss = async () => {
    if (!pendingLifecycle || !lossReason) return;
    const { itemId, previousLifecycle } = pendingLifecycle;

    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              lifecycle_stage: "perdido",
              stage: lifecycleToLegacyStage("perdido"),
              loss_reason: lossReason,
            }
          : i
      )
    );

    const result = await markPipelineAsLost(itemId, lossReason);
    if (result.error) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                lifecycle_stage: previousLifecycle,
                stage: lifecycleToLegacyStage(previousLifecycle),
                loss_reason: null,
              }
            : i
        )
      );
      toast(`Erro: ${result.error}`, "error");
    } else {
      toast("Lead marcado como perdido", "success");
      router.refresh();
    }
    setShowLossDialog(false);
    setLossReason("");
    setPendingLifecycle(null);
  };

  const handleChangeLifecycle = async (itemId: string, newLifecycle: LifecycleStage) => {
    if (newLifecycle === "perdido") {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      setPendingLifecycle({
        itemId,
        lifecycle: newLifecycle,
        previousLifecycle: getItemLifecycle(item),
      });
      setShowLossDialog(true);
      return;
    }
    const result = await changeLifecycleStage(itemId, newLifecycle);
    if (result.error) {
      toast(`Erro: ${result.error}`, "error");
    } else {
      toast("Etapa atualizada com sucesso", "success");
      router.refresh();
    }
  };

  const handleRegisterContact = async (item: PipelineItem) => {
    const result = await registerPipelineContact(item.id);
    if (result.error) {
      toast(`Erro: ${result.error}`, "error");
    } else {
      toast("Contato registrado", "success");
      router.refresh();
    }
  };

  const handleQualify = async (item: PipelineItem) => {
    const result = await qualifyPipelineLead(item.id, "mql");
    if (result.error) {
      toast(`Erro: ${result.error}`, "error");
    } else {
      toast("Lead qualificado", "success");
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

  const handleChangeStage = handleChangeLifecycle;

  const handleRegisterPatient = async (item: PipelineItem) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, lifecycle_stage: "qualificado" as LifecycleStage, stage: "cadastrado" }
          : i
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

  const lifecycleStages = LIFECYCLE_STAGES;

  const itemsByLifecycle = lifecycleStages.reduce(
    (acc, lifecycle) => {
      acc[lifecycle] = items.filter((item) => getItemLifecycle(item) === lifecycle);
      return acc;
    },
    {} as Record<LifecycleStage, PipelineItem[]>
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

  const lossDialog = (
    <Dialog open={showLossDialog} onOpenChange={setShowLossDialog}>
      <DialogContent title="Marcar como perdido">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione o motivo da perda para registrar no funil.
          </p>
          <Select
            value={lossReason}
            onChange={(e) => setLossReason(e.target.value)}
          >
            <option value="">Selecione o motivo...</option>
            {LOSS_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowLossDialog(false);
                setLossReason("");
                setPendingLifecycle(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmLoss} disabled={!lossReason}>
              Confirmar
            </Button>
          </div>
        </div>
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
                  onChangeLifecycle={handleChangeLifecycle}
                  onRegister={handleRegisterPatient}
                  onSchedule={handleScheduleAppointment}
                  onRegisterContact={handleRegisterContact}
                  onQualify={handleQualify}
                />
              </ListPanelItem>
            ))}
          </ListPanel>
        )}
        {noteDialog}
        {lossDialog}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!embedded && toolbar}

      <KanbanShell
        columns={lifecycleStages.map((lifecycle) => ({
          id: lifecycle,
          title: LIFECYCLE_STAGE_LABELS[lifecycle],
          accentClassName: LIFECYCLE_STAGE_ACCENT[lifecycle],
        }))}
        columnIds={[...lifecycleStages]}
        itemsByColumn={itemsByLifecycle}
        onMove={(itemId, toColumnId) =>
          moveToLifecycle(itemId, toColumnId as LifecycleStage)
        }
        renderCard={(item, { isDragging }) => (
          <PipelineCardContent
            item={item}
            isDragging={isDragging}
            onSelect={() => {
              setSelectedItem(item);
              setShowNoteDialog(true);
            }}
            onRegister={handleRegisterPatient}
            onSchedule={handleScheduleAppointment}
            onRegisterContact={handleRegisterContact}
            onQualify={handleQualify}
          />
        )}
        renderOverlay={(item) => (
          <PipelineCardContent
            item={item}
            isDragging
            onRegister={handleRegisterPatient}
            onSchedule={handleScheduleAppointment}
            onRegisterContact={handleRegisterContact}
            onQualify={handleQualify}
          />
        )}
      />

      {noteDialog}
      {lossDialog}
    </div>
  );
}

function PipelineCardContent({
  item,
  isDragging = false,
  onSelect,
  onRegister,
  onSchedule,
  onRegisterContact,
  onQualify,
}: {
  item: PipelineItem;
  isDragging?: boolean;
  onSelect?: () => void;
  onRegister?: (item: PipelineItem) => void;
  onSchedule?: (item: PipelineItem) => void;
  onRegisterContact?: (item: PipelineItem) => void;
  onQualify?: (item: PipelineItem) => void;
}) {
  const lifecycle = getEffectiveLifecycleStage(item);
  const scoreInfo = computePipelineItemScore(item);
  const tempColors: Record<LeadTemperature, string> = {
    frio: "text-blue-600",
    morno: "text-amber-600",
    quente: "text-red-600",
  };

  return (
    <KanbanCardShell isDragging={isDragging}>
      <div className="cursor-pointer" onClick={onSelect}>
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p className="text-sm font-medium truncate">{item.name || "Sem nome"}</p>
          <span className={cn("text-[10px] font-semibold", tempColors[scoreInfo.effectiveTemperature])}>
            {scoreInfo.score}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{item.email}</p>
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline" className="text-[10px]">
          {TEMPERATURE_LABELS[scoreInfo.effectiveTemperature]}
        </Badge>
        {item.source && (
          <Badge variant="secondary" className="text-[10px]">
            {LEAD_SOURCE_LABELS[item.source] ?? item.source}
          </Badge>
        )}
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
      {lifecycle === "lead_novo" && onRegisterContact && (
        <Button
          size="sm"
          variant="soft"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onRegisterContact(item);
          }}
        >
          <Phone className="h-3 w-3 mr-1" />
          Registrar contato
        </Button>
      )}
      {lifecycle === "em_qualificacao" && onQualify && (
        <Button
          size="sm"
          variant="soft"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onQualify(item);
          }}
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Qualificar
        </Button>
      )}
      {(lifecycle === "em_qualificacao" || lifecycle === "qualificado") && onRegister && (
        <Button
          size="sm"
          variant="outline"
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
      {lifecycle === "qualificado" && onSchedule && (
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
    </KanbanCardShell>
  );
}

function PipelineListItem({
  item,
  onSelect,
  onChangeLifecycle,
  onRegister,
  onSchedule,
  onRegisterContact,
  onQualify,
}: {
  item: PipelineItem;
  onSelect: () => void;
  onChangeLifecycle: (itemId: string, lifecycle: LifecycleStage) => void;
  onRegister?: (item: PipelineItem) => void;
  onSchedule?: (item: PipelineItem) => void;
  onRegisterContact?: (item: PipelineItem) => void;
  onQualify?: (item: PipelineItem) => void;
}) {
  const lifecycle = getEffectiveLifecycleStage(item);
  const scoreInfo = computePipelineItemScore(item);

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="text-sm font-medium">{item.name || "Sem nome"}</p>
          <Badge variant={LIFECYCLE_STAGE_BADGE_VARIANT[lifecycle]}>
            {LIFECYCLE_STAGE_LABELS[lifecycle]}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {scoreInfo.score} · {TEMPERATURE_LABELS[scoreInfo.effectiveTemperature]}
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
        {lifecycle === "lead_novo" && onRegisterContact && (
          <Button size="sm" variant="soft" onClick={() => onRegisterContact(item)}>
            <Phone className="h-4 w-4 mr-1" />
            Contato
          </Button>
        )}
        {lifecycle === "em_qualificacao" && onQualify && (
          <Button size="sm" variant="soft" onClick={() => onQualify(item)}>
            Qualificar
          </Button>
        )}
        {(lifecycle === "em_qualificacao" || lifecycle === "qualificado") && onRegister && (
          <Button size="sm" variant="soft" onClick={() => onRegister(item)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Cadastrar
          </Button>
        )}
        {lifecycle === "qualificado" && onSchedule && (
          <Button size="sm" variant="outline" onClick={() => onSchedule(item)}>
            <Calendar className="h-4 w-4 mr-1" />
            Agendar
          </Button>
        )}
        <Select
          value={lifecycle}
          onChange={(e) => onChangeLifecycle(item.id, e.target.value as LifecycleStage)}
          className="h-8 w-auto min-w-[140px] text-xs"
        >
          {LIFECYCLE_STAGES.map((value) => (
            <option key={value} value={value}>
              {LIFECYCLE_STAGE_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
