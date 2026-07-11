"use client";

import { useMemo } from "react";
import { EntityCombobox, type EntityOption } from "./entity-combobox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AppointmentOption = {
  id: string;
  scheduled_at: string;
  status: string;
  doctor_name: string | null;
  procedure_name: string | null;
};

function formatAppointmentLabel(a: AppointmentOption): string {
  const date = new Date(a.scheduled_at);
  const when = Number.isNaN(date.getTime())
    ? a.scheduled_at
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const proc = a.procedure_name ?? "Consulta";
  const doc = a.doctor_name ? ` · ${a.doctor_name}` : "";
  return `${proc}${doc} — ${when}`;
}

export function AppointmentPicker({
  appointments,
  valueId,
  onChangeId,
  label = "Consulta",
}: {
  appointments: AppointmentOption[];
  valueId: string;
  onChangeId: (id: string) => void;
  label?: string;
}) {
  const options: EntityOption[] = useMemo(
    () =>
      appointments.map((a) => ({
        id: a.id,
        label: formatAppointmentLabel(a),
        sublabel: a.status,
      })),
    [appointments]
  );

  const selected = options.find((o) => o.id === valueId) ?? null;

  return (
    <EntityCombobox
      label={label}
      placeholder={appointments.length ? "Selecionar consulta..." : "Nenhuma consulta — busque paciente primeiro"}
      value={selected}
      options={options}
      onChange={(opt) => onChangeId(opt?.id ?? "")}
    />
  );
}

export function DimensionValuesPicker({
  dimensions,
  values,
  selectedIds,
  onChange,
  label = "Convênio / dimensões",
}: {
  dimensions: Array<{ id: string; name: string }>;
  values: Array<{ id: string; dimension_id: string; name: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  if (!dimensions.length) {
    return (
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">Nenhuma dimensão de preço configurada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      {dimensions.map((dim) => {
        const dimValues = values.filter((v) => v.dimension_id === dim.id);
        if (!dimValues.length) return null;
        const selected = dimValues.find((v) => selectedIds.includes(v.id));
        return (
          <div key={dim.id} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{dim.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {dimValues.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    selectedIds.includes(v.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                  onClick={() => {
                    const withoutDim = selectedIds.filter(
                      (id) => !dimValues.some((dv) => dv.id === id)
                    );
                    onChange([...withoutDim, v.id]);
                  }}
                >
                  {v.name}
                </button>
              ))}
            </div>
            {selected && (
              <p className="text-[10px] font-mono text-muted-foreground">{selected.id.slice(0, 8)}…</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
