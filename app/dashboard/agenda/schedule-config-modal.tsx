"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ScheduleBlockForm } from "./schedule-block-form";
import { ScheduleBlocksList } from "./schedule-blocks-list";
import type { DoctorOption } from "./agenda-client";

export type ScheduleConfigTab = "create" | "list";

export function ScheduleConfigModal({
  open,
  onOpenChange,
  doctors,
  userRole,
  editingBlockId,
  initialPartial,
  initialTab = "create",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: DoctorOption[];
  userRole: string;
  editingBlockId?: string | null;
  initialPartial?: Partial<{
    date: string;
    timeStart: string;
    timeEnd: string;
    doctorId: string;
  }>;
  initialTab?: ScheduleConfigTab;
}) {
  const [tab, setTab] = useState<ScheduleConfigTab>(initialTab);
  const [localEditingId, setLocalEditingId] = useState<string | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  const effectiveEditingId = editingBlockId ?? localEditingId;

  useEffect(() => {
    if (!open) return;
    if (editingBlockId) {
      setTab("create");
      setLocalEditingId(editingBlockId);
    } else {
      setTab(initialTab);
      setLocalEditingId(null);
    }
  }, [open, editingBlockId, initialTab]);

  function handleClose() {
    onOpenChange(false);
    setLocalEditingId(null);
  }

  function handleEditFromList(blockId: string) {
    setLocalEditingId(blockId);
    setTab("create");
  }

  function handleFormSuccess() {
    setLocalEditingId(null);
    setListRefreshKey((k) => k + 1);
    if (!editingBlockId) {
      setTab("list");
    } else {
      handleClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent
        title="Indisponibilidades"
        onClose={handleClose}
        className="max-w-lg max-h-[90dvh] flex flex-col overflow-hidden"
      >
        <p className="text-sm text-muted-foreground -mt-2 mb-2">
          Bloqueie horários avulsos ou recorrentes. Consultas não poderão ser agendadas nesses intervalos.
        </p>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ScheduleConfigTab)} className="flex flex-col flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-2 mb-4 shrink-0">
            <TabsTrigger value="create" className="text-sm">
              {effectiveEditingId ? "Editar bloqueio" : "Novo bloqueio"}
            </TabsTrigger>
            <TabsTrigger value="list" className="text-sm">
              Períodos
            </TabsTrigger>
          </TabsList>

          <div className={cn("flex-1 min-h-0 overflow-y-auto", tab !== "create" && "hidden")}>
            <ScheduleBlockForm
              active={open && tab === "create"}
              doctors={doctors}
              userRole={userRole}
              editingBlockId={effectiveEditingId}
              initialPartial={initialPartial}
              onCancelEdit={
                effectiveEditingId
                  ? () => {
                      setLocalEditingId(null);
                    }
                  : undefined
              }
              onSuccess={handleFormSuccess}
            />
          </div>

          <div className={cn("flex-1 min-h-0", tab !== "list" && "hidden")}>
            <ScheduleBlocksList
              active={open && tab === "list"}
              doctors={doctors}
              onEdit={handleEditFromList}
              refreshKey={listRefreshKey}
            />
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
