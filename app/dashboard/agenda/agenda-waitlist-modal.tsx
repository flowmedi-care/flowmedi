"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { WaitlistEntriesList } from "./waitlist-entries-list";
import type { DoctorOption } from "./agenda-client";

export function AgendaWaitlistModal({
  open,
  onOpenChange,
  defaultDate,
  doctors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  doctors: DoctorOption[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Fila de espera"
        onClose={() => onOpenChange(false)}
        className="max-w-lg max-h-[90dvh] flex flex-col overflow-hidden"
      >
        <p className="text-sm text-muted-foreground -mt-2 mb-4">
          Pacientes aguardando vaga quando um horário é liberado. A fila não agenda automaticamente —
          você recebe um alerta e agenda manualmente. Entradas são adicionadas ao tentar agendar em
          horário ocupado.
        </p>
        <WaitlistEntriesList active={open} defaultDate={defaultDate} doctors={doctors} />
      </DialogContent>
    </Dialog>
  );
}
