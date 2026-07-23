"use client";

/**
 * Adapter Cases → KanbanShell (Agenda / Atendimentos / Pacientes).
 * Não misturar com lifecycle comercial de Contatos.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CaseProjectionItem, OpsBoardStage } from "@/lib/operational-journey";
import { AREA_COLUMNS, BOARD_STAGE_LABELS, type HojeArea } from "@/lib/operational-journey";
import { KanbanShell, KanbanCardShell, type KanbanColumnDef } from "@/components/kanban";
import { moveHojeOperationalCard } from "@/app/dashboard/hoje/move-actions";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const OPERATIONAL_AREAS = ["agenda", "atendimentos", "pacientes"] as const;
type OperationalArea = (typeof OPERATIONAL_AREAS)[number];

type CaseCard = CaseProjectionItem & { id: string };

function isOperationalArea(area: HojeArea): area is OperationalArea {
  return (OPERATIONAL_AREAS as readonly string[]).includes(area);
}

export function HojeCasesKanban({
  area,
  items,
  highlightCaseId,
  onOpenCase,
}: {
  area: HojeArea;
  items: CaseProjectionItem[];
  highlightCaseId?: string | null;
  onOpenCase: (item: CaseProjectionItem) => void;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<CaseProjectionItem[]>(items);

  useEffect(() => {
    setLocal(items);
  }, [items]);

  const columns: KanbanColumnDef[] = useMemo(
    () =>
      isOperationalArea(area)
        ? AREA_COLUMNS[area].map((stage) => ({
            id: stage,
            title: BOARD_STAGE_LABELS[stage],
            accentClassName: "bg-primary",
          }))
        : [],
    [area]
  );

  const itemsByColumn = useMemo(() => {
    if (!isOperationalArea(area)) return {} as Record<string, CaseCard[]>;
    const map: Record<string, CaseCard[]> = {};
    for (const col of AREA_COLUMNS[area]) map[col] = [];
    for (const item of local) {
      const card: CaseCard = { ...item, id: item.caseId };
      const stage = item.boardStage;
      if (stage && map[stage]) map[stage].push(card);
      else map[AREA_COLUMNS[area][0]].push(card);
    }
    return map;
  }, [local, area]);

  if (!isOperationalArea(area)) return null;

  const operationalArea = area;

  async function onMove(itemId: string, toColumnId: string) {
    const item = local.find((i) => i.caseId === itemId);
    if (!item) return;
    const targetStage = toColumnId as OpsBoardStage;
    if (item.boardStage === targetStage) return;

    const previous = item.boardStage;
    setLocal((prev) =>
      prev.map((i) =>
        i.caseId === itemId ? { ...i, boardStage: targetStage } : i
      )
    );

    const res = await moveHojeOperationalCard({
      caseId: itemId,
      area: operationalArea,
      targetStage,
      appointmentId: item.appointmentId,
    });

    if (!res.ok) {
      setLocal((prev) =>
        prev.map((i) =>
          i.caseId === itemId ? { ...i, boardStage: previous } : i
        )
      );
      toast(`Erro ao mover: ${res.error ?? "falha"}`, "error");
      return;
    }

    toast("Etapa atualizada", "success");
    router.refresh();
  }

  return (
    <KanbanShell
      columns={columns}
      columnIds={[...AREA_COLUMNS[operationalArea]]}
      itemsByColumn={itemsByColumn}
      onMove={onMove}
      renderCard={(item, { isDragging }) => (
        <KanbanCardShell
          isDragging={isDragging}
          className={cn(
            highlightCaseId === item.caseId && "border-primary ring-2 ring-primary/20"
          )}
          onClick={() => onOpenCase(item)}
        >
          <p className="text-[13px] font-medium truncate">{item.displayName}</p>
          {item.nextDecision && (
            <p className="text-[11px] text-muted-foreground line-clamp-2">
              {item.nextDecision.label}
              {item.nextDecision.reason ? ` · ${item.nextDecision.reason}` : ""}
            </p>
          )}
        </KanbanCardShell>
      )}
    />
  );
}
