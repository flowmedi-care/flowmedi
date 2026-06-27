"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import {
  createScheduleBlock,
  getScheduleBlockForEdit,
  updateScheduleBlock,
} from "./schedule-block-actions";
import {
  expandBlockOccurrences,
  RECURRENCE_FREQUENCY_LABELS,
  WEEKDAY_OPTIONS,
  type ScheduleBlockInput,
  type ScheduleBlockKind,
} from "@/lib/schedule-blocks";
import type { RecurrenceFrequency } from "@/lib/recurrence-schedule";
import { localDateToISO } from "./agenda-date-utils";
import type { DoctorOption } from "./agenda-client";

function combineDateAndTimeToIso(dateYmd: string, timeHm: string): string {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const [hh, mm] = timeHm.split(":").map(Number);
  return localDateToISO(y, m, d, hh, mm || 0);
}

type Scope = "clinic" | "doctor";

const defaultForm = (doctorId?: string): ScheduleBlockInput => ({
  blockKind: "once",
  doctorId: doctorId ?? null,
  title: "",
  startsAt: null,
  endsAt: null,
  recurrenceFrequency: "semanal",
  recurrenceWeekday: new Date().getDay(),
  timeStart: "09:00",
  timeEnd: "10:00",
  recurrenceStartDate: new Date().toISOString().slice(0, 10),
  recurrenceEndDate: null,
});

export function ScheduleBlockForm({
  active,
  doctors,
  userRole,
  editingBlockId,
  initialPartial,
  onCancelEdit,
  onSuccess,
}: {
  active: boolean;
  doctors: DoctorOption[];
  userRole: string;
  editingBlockId?: string | null;
  initialPartial?: Partial<{
    date: string;
    timeStart: string;
    timeEnd: string;
    doctorId: string;
  }>;
  onCancelEdit?: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(editingBlockId);
  const canBlockClinic = userRole === "admin" || userRole === "secretaria";
  const isDoctor = userRole === "medico";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<Scope>("doctor");
  const [doctorId, setDoctorId] = useState("");
  const [form, setForm] = useState<ScheduleBlockInput>(() =>
    defaultForm(isDoctor ? doctors[0]?.id : undefined)
  );
  const [onceDate, setOnceDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!active) return;

    if (editingBlockId) {
      setLoading(true);
      getScheduleBlockForEdit(editingBlockId).then((res) => {
        setLoading(false);
        if (res.error || !res.data) {
          toast(res.error ?? "Não foi possível carregar.", "error");
          return;
        }
        const data = res.data;
        setForm(data);
        setScope(data.doctorId ? "doctor" : "clinic");
        setDoctorId(data.doctorId ?? "");
        if (data.blockKind === "once" && data.startsAt) {
          setOnceDate(data.startsAt.slice(0, 10));
        }
      });
      return;
    }

    const base = defaultForm(
      isDoctor ? doctors[0]?.id : doctors.length === 1 ? doctors[0]?.id : undefined
    );
    if (initialPartial?.doctorId) {
      base.doctorId = initialPartial.doctorId;
      setDoctorId(initialPartial.doctorId);
      setScope("doctor");
    } else if (isDoctor && doctors[0]?.id) {
      base.doctorId = doctors[0].id;
      setDoctorId(doctors[0].id);
      setScope("doctor");
    } else {
      setScope("doctor");
      setDoctorId(doctors[0]?.id ?? "");
    }
    if (initialPartial?.date) setOnceDate(initialPartial.date);
    if (initialPartial?.timeStart) base.timeStart = initialPartial.timeStart;
    if (initialPartial?.timeEnd) base.timeEnd = initialPartial.timeEnd;
    setForm(base);
  }, [active, editingBlockId, doctors, isDoctor, initialPartial]);

  const previewOccurrences = useMemo(() => {
    const draft: ScheduleBlockInput = {
      ...form,
      doctorId: scope === "clinic" ? null : doctorId || null,
    };
    if (draft.blockKind === "once") {
      if (!onceDate || !draft.timeStart || !draft.timeEnd) return [];
      draft.startsAt = combineDateAndTimeToIso(onceDate, draft.timeStart);
      draft.endsAt = combineDateAndTimeToIso(onceDate, draft.timeEnd);
    }
    const row = {
      id: "preview",
      clinic_id: "",
      doctor_id: draft.doctorId,
      title: draft.title ?? null,
      block_kind: draft.blockKind,
      starts_at: draft.startsAt ?? null,
      ends_at: draft.endsAt ?? null,
      recurrence_frequency: draft.recurrenceFrequency ?? null,
      recurrence_weekday: draft.recurrenceWeekday ?? null,
      time_start: `${draft.timeStart}:00`,
      time_end: `${draft.timeEnd}:00`,
      recurrence_start_date: draft.recurrenceStartDate ?? null,
      recurrence_end_date: draft.recurrenceEndDate ?? null,
    };
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 56);
    return expandBlockOccurrences(row, start, end).slice(0, 6);
  }, [form, scope, doctorId, onceDate]);

  function patchForm(patch: Partial<ScheduleBlockInput>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload: ScheduleBlockInput = {
      ...form,
      doctorId: scope === "clinic" ? null : doctorId || null,
      title: form.title?.trim() || null,
    };

    if (payload.blockKind === "once") {
      if (!onceDate) {
        toast("Informe a data.", "error");
        setSaving(false);
        return;
      }
      payload.startsAt = combineDateAndTimeToIso(onceDate, payload.timeStart);
      payload.endsAt = combineDateAndTimeToIso(onceDate, payload.timeEnd);
    }

    const res = isEdit && editingBlockId
      ? await updateScheduleBlock(editingBlockId, payload)
      : await createScheduleBlock(payload);

    setSaving(false);

    if ("error" in res && res.error) {
      toast(res.error, "error");
      return;
    }

    toast(isEdit ? "Período atualizado." : "Horário bloqueado.", "success");
    onSuccess?.();
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Carregando…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isEdit && onCancelEdit && (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 -ml-2" onClick={onCancelEdit}>
          ← Novo bloqueio
        </Button>
      )}

      {canBlockClinic && !isDoctor && (
        <div className="space-y-2">
          <Label>Escopo</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                scope === "doctor" && "border-primary bg-primary/10"
              )}
              onClick={() => setScope("doctor")}
            >
              Profissional
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                scope === "clinic" && "border-primary bg-primary/10"
              )}
              onClick={() => setScope("clinic")}
            >
              Toda a clínica
            </button>
          </div>
        </div>
      )}

      {scope === "doctor" && (
        <div className="space-y-2">
          <Label htmlFor="block-doctor">Profissional</Label>
          <select
            id="block-doctor"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            required
            disabled={isDoctor}
          >
            <option value="">Selecione…</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="block-title">Motivo (opcional)</Label>
        <Input
          id="block-title"
          value={form.title ?? ""}
          onChange={(e) => patchForm({ title: e.target.value })}
          placeholder="Ex.: Compromisso externo, treinamento…"
        />
      </div>

      <div className="space-y-2">
        <Label>Tipo</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["once", "recurring"] as ScheduleBlockKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                form.blockKind === kind && "border-primary bg-primary/10"
              )}
              onClick={() => patchForm({ blockKind: kind })}
            >
              {kind === "once" ? "Avulso" : "Recorrente"}
            </button>
          ))}
        </div>
      </div>

      {form.blockKind === "once" ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="block-date">Data</Label>
            <Input
              id="block-date"
              type="date"
              value={onceDate}
              onChange={(e) => setOnceDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-start">Início</Label>
            <Input
              id="block-start"
              type="time"
              value={form.timeStart}
              onChange={(e) => patchForm({ timeStart: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-end">Término</Label>
            <Input
              id="block-end"
              type="time"
              value={form.timeEnd}
              onChange={(e) => patchForm({ timeEnd: e.target.value })}
              required
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rec-start">A partir de</Label>
              <Input
                id="rec-start"
                type="date"
                value={form.recurrenceStartDate ?? ""}
                onChange={(e) => patchForm({ recurrenceStartDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-end">Até (opcional)</Label>
              <Input
                id="rec-end"
                type="date"
                value={form.recurrenceEndDate ?? ""}
                onChange={(e) => patchForm({ recurrenceEndDate: e.target.value || null })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rec-frequency">Frequência</Label>
              <select
                id="rec-frequency"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.recurrenceFrequency ?? "semanal"}
                onChange={(e) =>
                  patchForm({ recurrenceFrequency: e.target.value as RecurrenceFrequency })
                }
              >
                {(Object.keys(RECURRENCE_FREQUENCY_LABELS) as RecurrenceFrequency[]).map((f) => (
                  <option key={f} value={f}>
                    {RECURRENCE_FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            {form.recurrenceFrequency === "semanal" && (
              <div className="space-y-2">
                <Label htmlFor="rec-weekday">Dia da semana</Label>
                <select
                  id="rec-weekday"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.recurrenceWeekday ?? 1}
                  onChange={(e) => patchForm({ recurrenceWeekday: Number(e.target.value) })}
                >
                  {WEEKDAY_OPTIONS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rec-time-start">Início</Label>
              <Input
                id="rec-time-start"
                type="time"
                value={form.timeStart}
                onChange={(e) => patchForm({ timeStart: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-time-end">Término</Label>
              <Input
                id="rec-time-end"
                type="time"
                value={form.timeEnd}
                onChange={(e) => patchForm({ timeEnd: e.target.value })}
                required
              />
            </div>
          </div>
        </div>
      )}

      {previewOccurrences.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase">Próximas ocorrências</p>
          {previewOccurrences.map((occ) => (
            <p key={occ.startsAt} className="text-sm">
              {new Date(occ.startsAt).toLocaleString("pt-BR", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" – "}
              {new Date(occ.endsAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : isEdit ? "Salvar" : "Bloquear"}
        </Button>
      </div>
    </form>
  );
}
