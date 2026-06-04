"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RecurrenceSeriesDialog } from "../../recurrence-series-dialog";
import { useRouter } from "next/navigation";

// RECORRÊNCIA v1 — Botão "Ver série" na ficha da consulta.
// Contrato: FLUXO-OPERACIONAL-COMPLETO.md § Parte 3
export function RecurrenceSeriesButton({
  recurrenceGroupId,
  appointmentId,
  canManage,
}: {
  recurrenceGroupId: string;
  appointmentId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!recurrenceGroupId) return null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Ver série
      </Button>
      <RecurrenceSeriesDialog
        open={open}
        onOpenChange={setOpen}
        recurrenceGroupId={recurrenceGroupId}
        referenceAppointmentId={appointmentId}
        onUpdated={() => router.refresh()}
      />
      {!canManage && open && (
        <p className="text-xs text-muted-foreground sr-only">
          Visualização da série
        </p>
      )}
    </>
  );
}
