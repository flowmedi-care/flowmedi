"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { completeDemoAttendanceAction } from "@/lib/onboarding/actions";
import { Sparkles } from "lucide-react";

export function TourAttendanceBanner({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleComplete() {
    setError(null);
    startTransition(async () => {
      const res = await completeDemoAttendanceAction(appointmentId);
      if (res.error) {
        setError(res.error);
        return;
      }
      window.dispatchEvent(
        new CustomEvent("flowmedi:micro-win", {
          detail: { message: "Atendimento concluído." },
        })
      );
      window.dispatchEvent(
        new CustomEvent("flowmedi:tour-step", {
          detail: { step: "payment" },
        })
      );
      router.push(`/dashboard/agenda/atendimento/${appointmentId}?tour=1&finalize=1`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold">Maria chegou — conclua o atendimento demo</p>
          <p className="text-xs text-muted-foreground">
            Um clique finaliza o atendimento e abre a comanda. Tudo é demonstração e pode ser apagado.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button size="sm" disabled={pending} onClick={handleComplete}>
            {pending ? "Concluindo…" : "Concluir atendimento demo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
