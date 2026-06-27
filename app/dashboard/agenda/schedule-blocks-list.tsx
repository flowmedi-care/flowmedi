"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  deleteScheduleBlock,
  listScheduleBlocks,
  type ScheduleBlockListItem,
} from "./schedule-block-actions";
import {
  formatBlockKindLabel,
  formatBlockScopeLabel,
  RECURRENCE_FREQUENCY_LABELS,
} from "@/lib/schedule-blocks";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import type { DoctorOption } from "./agenda-client";

function formatBlockSummary(block: ScheduleBlockListItem): string {
  if (block.block_kind === "once" && block.starts_at && block.ends_at) {
    const start = new Date(block.starts_at);
    const end = new Date(block.ends_at);
    return `${start.toLocaleDateString("pt-BR")} · ${start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  const freq = block.recurrence_frequency
    ? RECURRENCE_FREQUENCY_LABELS[block.recurrence_frequency]
    : "Recorrente";
  const timeStart = block.time_start.slice(0, 5);
  const timeEnd = block.time_end.slice(0, 5);
  return `${freq} · ${timeStart}–${timeEnd}`;
}

export function ScheduleBlocksList({
  active,
  doctors,
  onEdit,
  refreshKey = 0,
}: {
  active: boolean;
  doctors: DoctorOption[];
  onEdit: (blockId: string) => void;
  refreshKey?: number;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<ScheduleBlockListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBlocks = useCallback(() => {
    setLoading(true);
    listScheduleBlocks().then((res) => {
      setLoading(false);
      if (res.error) toast(res.error, "error");
      else setBlocks(res.data);
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    loadBlocks();
  }, [active, refreshKey, loadBlocks]);

  async function handleDelete(id: string) {
    const res = await deleteScheduleBlock(id);
    if (res.error) toast(res.error, "error");
    else {
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      toast("Bloqueio removido.", "success");
      router.refresh();
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Carregando…</p>;
  }

  if (blocks.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Nenhum bloqueio cadastrado.</p>;
  }

  return (
    <div className="space-y-2 max-h-[min(50vh,24rem)] overflow-y-auto pr-1">
      {blocks.map((block) => (
        <div
          key={block.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium truncate">
                {block.title?.trim() || "Indisponível"}
              </span>
              <Badge variant="outline" className="text-xs">
                {formatBlockKindLabel(block.block_kind)}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs mt-0.5">
              {formatBlockScopeLabel(
                block.doctor_id,
                block.doctor_name ?? doctors.find((d) => d.id === block.doctor_id)?.full_name
              )}
              {" · "}
              {formatBlockSummary(block)}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(block.id)}>
              Editar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(block.id)}>
              Excluir
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
