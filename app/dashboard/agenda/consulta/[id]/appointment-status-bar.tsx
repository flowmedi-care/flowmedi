"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { updateAppointment, deleteAppointment } from "../../actions";
import { AppointmentCancelWizard } from "../../components/appointment-cancel-wizard";
import { toast } from "@/components/ui/toast";
import { Trash2, Clock } from "lucide-react";
import { getStatusBackgroundColor, getStatusTextColor } from "../../status-utils";
import { cn } from "@/lib/utils";

export function AppointmentStatusBar({
  appointmentId,
  appointmentStatus,
  startedAt,
  durationMinutes,
  canEdit,
  isDoctor,
  userRole,
}: {
  appointmentId: string;
  appointmentStatus: string;
  startedAt: string | null;
  durationMinutes: number | null;
  canEdit: boolean;
  isDoctor: boolean;
  userRole?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(appointmentStatus);
  const [startedAtState, setStartedAtState] = useState(startedAt);
  const [durationMinutesState, setDurationMinutesState] = useState(durationMinutes);
  const [updating, setUpdating] = useState(false);
  const [showExcluirConfirm, setShowExcluirConfirm] = useState(false);
  const [cancelWizardOpen, setCancelWizardOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<"cancelada" | "falta" | null>(null);

  useEffect(() => {
    setStatus(appointmentStatus);
  }, [appointmentStatus]);

  const canChangeStatus = isDoctor || canEdit;
  const isPendingStatus = status === "agendada" || status === "confirmada";
  const isInProgress = !!startedAtState && isPendingStatus;
  const showInProgress = canChangeStatus && isInProgress;

  async function handleStatusChange(newStatus: string) {
    if (newStatus === "cancelada" || newStatus === "falta") {
      setCancelTarget(newStatus);
      setCancelWizardOpen(true);
      return;
    }

    setUpdating(true);
    const res = await updateAppointment(appointmentId, { status: newStatus });
    if (!res.error) {
      setStatus(newStatus);
      if (newStatus === "realizada" && startedAtState) {
        setDurationMinutesState(
          Math.round((Date.now() - new Date(startedAtState).getTime()) / 60000)
        );
      }
      if (res.waitlistMatches?.length) {
        toast(
          `Vaga liberada — ${res.waitlistMatches.length} paciente(s) na fila de espera.`,
          "success"
        );
      }
      if (newStatus === "realizada") router.refresh();
    } else {
      toast(res.error, "error");
    }
    setUpdating(false);
  }

  function handleWizardClose(open: boolean) {
    setCancelWizardOpen(open);
    if (!open) {
      setCancelTarget(null);
      router.refresh();
    }
  }

  function handleWizardComplete() {
    if (cancelTarget) setStatus(cancelTarget);
    setCancelWizardOpen(false);
    setCancelTarget(null);
    router.refresh();
  }

  async function confirmExcluir() {
    setUpdating(true);
    const res = await deleteAppointment(appointmentId);
    setUpdating(false);
    if (!res.error) {
      setShowExcluirConfirm(false);
      router.push("/dashboard/agenda");
    }
  }

  if (!canChangeStatus) return null;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {showInProgress && (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 flex flex-wrap items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Atendimento em andamento desde{" "}
              {startedAtState
                ? new Date(startedAtState).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </span>
            <Button
              variant="default"
              size="sm"
              onClick={() => handleStatusChange("realizada")}
              disabled={updating}
              className="ml-auto gap-2 bg-green-600 hover:bg-green-700"
            >
              ✓ Marcar como realizada
            </Button>
          </div>
        )}

        {status === "realizada" && (durationMinutesState ?? durationMinutes) != null && (
          <p className="text-sm text-muted-foreground">
            Duração do atendimento:{" "}
            <strong>{durationMinutesState ?? durationMinutes} min</strong>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground mr-1">Status:</span>
          {(canEdit && !isDoctor
            ? ["agendada", "confirmada", "realizada", "falta", "cancelada"]
            : ["realizada", "falta"]
          ).map((s) => {
            if (showInProgress && (s === "realizada" || s === "falta")) return null;
            const isActive = status === s;
            const bgColor = getStatusBackgroundColor(s);
            const textColor = getStatusTextColor(s);
            const label =
              s === "agendada"
                ? "Agendada"
                : s === "confirmada"
                  ? "Confirmada"
                  : s === "realizada"
                    ? "Realizada"
                    : s === "falta"
                      ? "Falta"
                      : "Cancelada";
            return (
              <Button
                key={s}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange(s)}
                disabled={updating}
                className={cn(
                  isActive && bgColor,
                  isActive && textColor,
                  isActive && "font-semibold",
                  !isActive && "hover:opacity-80"
                )}
              >
                {s === "realizada" ? "✓ " : s === "falta" ? "✗ " : ""}
                {label}
              </Button>
            );
          })}

          {canEdit && !isDoctor && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExcluirConfirm(true)}
              disabled={updating}
              className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir
            </Button>
          )}
        </div>
      </CardContent>

      <ConfirmDialog
        open={showExcluirConfirm}
        title="Excluir agendamento"
        message="Tem certeza que deseja excluir este agendamento?"
        confirmLabel="Excluir"
        variant="destructive"
        loading={updating}
        onConfirm={confirmExcluir}
        onCancel={() => setShowExcluirConfirm(false)}
      />

      <AppointmentCancelWizard
        appointmentId={appointmentId}
        targetStatus={cancelTarget}
        open={cancelWizardOpen}
        onOpenChange={handleWizardClose}
        onComplete={handleWizardComplete}
        userRole={userRole}
      />
    </Card>
  );
}
