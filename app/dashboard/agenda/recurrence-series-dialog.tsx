"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import {
  getRecurrenceSeries,
  updateRecurrenceSessionSchedule,
  cancelRecurrenceSession,
  cancelFutureRecurrenceSessions,
  addRecurrenceSession,
  type RecurrenceSeriesAppointment,
} from "./recurrence-actions";
import {
  formatRecurrenceSessionLine,
  inferFrequencyLabel,
  weekdayLabelFromDate,
} from "@/lib/recurrence-schedule";

function statusLabel(status: string): string {
  if (status === "realizada" || status === "cobrada") return "✅ Realizada";
  if (status === "cancelada") return "Cancelada";
  return "🕐 Agendada";
}

function canEditSchedule(status: string): boolean {
  return status === "agendada" || status === "confirmada";
}

// RECORRÊNCIA v1 — Modal para editar/cancelar sessões da série.
// Contrato: FLUXO-OPERACIONAL-COMPLETO.md § Parte 3
export function RecurrenceSeriesDialog({
  open,
  onOpenChange,
  recurrenceGroupId,
  referenceAppointmentId,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurrenceGroupId: string;
  referenceAppointmentId: string;
  onUpdated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<RecurrenceSeriesAppointment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [showCancelAll, setShowCancelAll] = useState(false);
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [hasTreatmentPlan, setHasTreatmentPlan] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");

  async function loadSeries() {
    setLoading(true);
    const res = await getRecurrenceSeries(recurrenceGroupId);
    setLoading(false);
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    setPatientName(res.patientName);
    setAppointments(res.appointments);
    setHasTreatmentPlan(
      res.appointments.some((a) => a.treatment_plan_id != null)
    );
  }

  useEffect(() => {
    if (open) loadSeries();
  }, [open, recurrenceGroupId]);

  const freqLabel = inferFrequencyLabel(appointments);
  const first = appointments[0];
  const firstDateYmd = first
    ? new Date(first.scheduled_at).toISOString().slice(0, 10)
    : "";
  const firstFmt = first ? formatRecurrenceSessionLine(first.scheduled_at) : null;
  const subtitle =
    firstFmt && freqLabel
      ? `${weekdayLabelFromDate(firstDateYmd)}, ${firstFmt.time} · ${freqLabel} · ${appointments.length} sessões`
      : `${appointments.length} sessões`;

  async function saveEdit(id: string) {
    const local = new Date(`${editDate}T${editTime}:00`);
    const res = await updateRecurrenceSessionSchedule(id, local.toISOString());
    if (res.error) toast(res.error, "error");
    else {
      toast("Data/hora atualizada.", "success");
      setEditingId(null);
      await loadSeries();
      onUpdated();
    }
  }

  async function handleCancelOne(id: string) {
    const res = await cancelRecurrenceSession(id);
    if (res.error) toast(res.error, "error");
    else {
      toast("Sessão cancelada.", "success");
      await loadSeries();
      onUpdated();
    }
  }

  async function handleCancelAllFuture() {
    const res = await cancelFutureRecurrenceSessions(recurrenceGroupId);
    if (res.error) toast(res.error, "error");
    else {
      toast(`${res.cancelled} sessão(ões) cancelada(s).`, "success");
      setShowCancelAll(false);
      await loadSeries();
      onUpdated();
    }
  }

  async function handleAddSession() {
    if (!newDate) {
      toast("Informe a data da nova sessão.", "error");
      return;
    }
    setAdding(true);
    const local = new Date(`${newDate}T${newTime}:00`);
    const res = await addRecurrenceSession({
      recurrenceGroupId,
      scheduledAt: local.toISOString(),
      copyFromAppointmentId: referenceAppointmentId,
    });
    setAdding(false);
    setShowAddConfirm(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Sessão adicionada.", "success");
      setNewDate("");
      await loadSeries();
      onUpdated();
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          title={`Série de consultas${patientName ? ` — ${patientName}` : ""}`}
          onClose={() => onOpenChange(false)}
          className="max-w-lg"
        >
          <p className="text-sm text-muted-foreground -mt-2 mb-4">{subtitle}</p>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <ul className="space-y-2 text-sm max-h-80 overflow-y-auto">
              {appointments.map((a) => {
                const fmt = formatRecurrenceSessionLine(a.scheduled_at);
                const editable = canEditSchedule(a.status);
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-2 justify-between rounded-md border px-2 py-2"
                  >
                    {editingId === a.id ? (
                      <div className="flex flex-wrap gap-2 w-full">
                        <Input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                        />
                        <Input
                          type="time"
                          step={60}
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                        />
                        <Button type="button" size="sm" onClick={() => saveEdit(a.id)}>
                          Salvar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span>
                          Sessão {a.session_number ?? "—"}{" "}
                          <span className="text-muted-foreground">
                            {fmt.weekdayShort} {fmt.date} {fmt.time}
                          </span>{" "}
                          {statusLabel(a.status)}
                        </span>
                        <div className="flex gap-1">
                          {editable ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const d = new Date(a.scheduled_at);
                                  setEditDate(d.toISOString().slice(0, 10));
                                  setEditTime(d.toTimeString().slice(0, 5));
                                  setEditingId(a.id);
                                }}
                              >
                                Editar data/hora
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelOne(a.id)}
                              >
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 pt-4 border-t space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Nova sessão — data e hora</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
                <Input
                  type="time"
                  step={60}
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={adding}
                onClick={() => {
                  if (hasTreatmentPlan) setShowAddConfirm(true);
                  else void handleAddSession();
                }}
              >
                + Adicionar sessão
              </Button>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowCancelAll(true)}
            >
              Cancelar todas as sessões futuras
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showCancelAll}
        title="Cancelar sessões futuras"
        message="Cancela apenas consultas com status agendada ou confirmada. Realizadas não serão alteradas."
        confirmLabel="Cancelar sessões"
        variant="destructive"
        onConfirm={handleCancelAllFuture}
        onCancel={() => setShowCancelAll(false)}
      />

      <ConfirmDialog
        open={showAddConfirm}
        title="Adicionar sessão ao plano"
        message="Isso não altera o valor do plano de tratamento. A nova sessão será adicionada sem valor financeiro vinculado automaticamente."
        confirmLabel="Adicionar"
        variant="default"
        onConfirm={handleAddSession}
        onCancel={() => setShowAddConfirm(false)}
      />
    </>
  );
}
