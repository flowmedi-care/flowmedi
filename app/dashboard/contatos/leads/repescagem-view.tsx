"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/dashboard-ui/kanban/kanban-board";
import { KanbanColumnShell } from "@/components/dashboard-ui/kanban/kanban-column";
import { KanbanCardShell } from "@/components/dashboard-ui/kanban/kanban-card";
import { KanbanEmptyColumn } from "@/components/dashboard-ui/kanban/kanban-empty-column";
import { ListPanel, ListPanelItem } from "@/components/dashboard-ui/list-panel";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import { formatPhoneBr } from "@/lib/format-phone";
import { lossReasonLabel } from "@/lib/leads/loss-reasons";
import type { RepescagemItem } from "./actions";
import { archiveRepescagem, qualifyRepescagem } from "./actions";
import { toast } from "@/components/ui/toast";
import { CheckCircle, Archive, ExternalLink } from "lucide-react";

const STATUS_COLUMNS = [
  { id: "sugerido" as const, label: "Sugeridos" },
  { id: "ativo" as const, label: "Ativos" },
  { id: "arquivado" as const, label: "Arquivados" },
];

const SOURCE_LABELS: Record<string, string> = {
  falta: "Falta",
  cancelamento: "Cancelamento",
  manual: "Manual",
  captacao: "Captação",
};

export function RepescagemView({
  items,
  viewMode,
}: {
  items: RepescagemItem[];
  viewMode: "kanban" | "list";
}) {
  const router = useRouter();

  async function handleQualify(id: string) {
    const res = await qualifyRepescagem(id);
    if (res.error) toast(res.error, "error");
    else {
      toast("Lead qualificado para repescagem.", "success");
      router.refresh();
    }
  }

  async function handleArchive(id: string) {
    const res = await archiveRepescagem(id);
    if (res.error) toast(res.error, "error");
    else {
      toast("Oportunidade arquivada.", "success");
      router.refresh();
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhuma oportunidade de repescagem"
        description="Faltas e cancelamentos geram sugestões automaticamente."
      />
    );
  }

  if (viewMode === "list") {
    return (
      <ListPanel>
        {items.map((item) => (
          <ListPanelItem key={item.id}>
            <RepescagemRow
              item={item}
              onQualify={handleQualify}
              onArchive={handleArchive}
              onOpenPatient={(id) =>
                router.push(`/dashboard/contatos/pacientes/${id}`)
              }
            />
          </ListPanelItem>
        ))}
      </ListPanel>
    );
  }

  return (
    <KanbanBoard>
      {STATUS_COLUMNS.map((col) => {
        const colItems = items.filter((i) => i.status === col.id);
        return (
          <KanbanColumnShell
            key={col.id}
            title={col.label}
            count={colItems.length}
          >
            {colItems.length === 0 ? (
              <KanbanEmptyColumn />
            ) : (
              colItems.map((item) => (
                <KanbanCardShell key={item.id}>
                  <p className="text-sm font-medium truncate">{item.patient_name}</p>
                  {item.patient_email && (
                    <p className="text-xs text-muted-foreground truncate">{item.patient_email}</p>
                  )}
                  {item.patient_phone && (
                    <p className="text-xs text-muted-foreground">{formatPhoneBr(item.patient_phone)}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      {SOURCE_LABELS[item.source] ?? item.source}
                    </Badge>
                    {item.loss_reason && (
                      <Badge variant="secondary" className="text-[10px]">
                        {lossReasonLabel(item.loss_reason)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        router.push(`/dashboard/contatos/pacientes/${item.patient_id}`)
                      }
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Perfil
                    </Button>
                    {item.status === "sugerido" && (
                      <Button
                        variant="soft"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleQualify(item.id)}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Qualificar
                      </Button>
                    )}
                    {item.status !== "arquivado" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleArchive(item.id)}
                      >
                        <Archive className="h-3 w-3 mr-1" />
                        Arquivar
                      </Button>
                    )}
                  </div>
                </KanbanCardShell>
              ))
            )}
          </KanbanColumnShell>
        );
      })}
    </KanbanBoard>
  );
}

function RepescagemRow({
  item,
  onQualify,
  onArchive,
  onOpenPatient,
}: {
  item: RepescagemItem;
  onQualify: (id: string) => void;
  onArchive: (id: string) => void;
  onOpenPatient: (id: string) => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium">{item.patient_name}</p>
          <Badge variant="outline" className="text-[10px] capitalize">
            {item.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {[item.patient_email, item.patient_phone ? formatPhoneBr(item.patient_phone) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {item.loss_reason && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Motivo: {lossReasonLabel(item.loss_reason)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => onOpenPatient(item.patient_id)}>
          <ExternalLink className="h-4 w-4" />
        </Button>
        {item.status === "sugerido" && (
          <Button variant="soft" size="sm" onClick={() => onQualify(item.id)}>
            Qualificar
          </Button>
        )}
        {item.status !== "arquivado" && (
          <Button variant="outline" size="sm" onClick={() => onArchive(item.id)}>
            Arquivar
          </Button>
        )}
      </div>
    </div>
  );
}
