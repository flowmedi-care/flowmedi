"use client";

import { useMemo } from "react";
import { EntityCombobox, type EntityOption } from "./entity-combobox";
import type { PlaygroundCatalog } from "@/lib/virtual-assistant/tools/playground-catalog";

export function DoctorPicker({
  catalog,
  valueId,
  onChangeId,
  label = "Médico",
}: {
  catalog: PlaygroundCatalog | null;
  valueId: string;
  onChangeId: (id: string) => void;
  label?: string;
}) {
  const options: EntityOption[] = useMemo(
    () =>
      (catalog?.doctors ?? []).map((d) => ({
        id: d.id,
        label: d.full_name,
        sublabel: d.specialty ?? undefined,
      })),
    [catalog]
  );

  const selected = options.find((o) => o.id === valueId) ?? null;

  return (
    <EntityCombobox
      label={label}
      placeholder="Selecionar médico..."
      value={selected}
      options={options}
      onChange={(opt) => onChangeId(opt?.id ?? "")}
    />
  );
}

export function ProcedurePicker({
  catalog,
  valueId,
  onChangeId,
  doctorId,
  label = "Procedimento",
}: {
  catalog: PlaygroundCatalog | null;
  valueId: string;
  onChangeId: (id: string) => void;
  doctorId?: string;
  label?: string;
}) {
  const options: EntityOption[] = useMemo(() => {
    let procs = catalog?.procedures ?? [];
    if (doctorId) {
      procs = procs.filter((p) => p.doctor_ids.length === 0 || p.doctor_ids.includes(doctorId));
    }
    return procs.map((p) => ({
      id: p.id,
      label: p.name,
      sublabel: `${p.duration_minutes} min`,
    }));
  }, [catalog, doctorId]);

  const selected = options.find((o) => o.id === valueId) ?? null;

  return (
    <EntityCombobox
      label={label}
      placeholder="Selecionar procedimento..."
      value={selected}
      options={options}
      onChange={(opt) => onChangeId(opt?.id ?? "")}
    />
  );
}

export function ServicePicker({
  catalog,
  valueId,
  onChangeId,
  label = "Serviço",
}: {
  catalog: PlaygroundCatalog | null;
  valueId: string;
  onChangeId: (id: string) => void;
  label?: string;
}) {
  const options: EntityOption[] = useMemo(
    () =>
      (catalog?.services ?? []).map((s) => ({
        id: s.id,
        label: s.name,
      })),
    [catalog]
  );

  const selected = options.find((o) => o.id === valueId) ?? null;

  return (
    <EntityCombobox
      label={label}
      placeholder="Selecionar serviço..."
      value={selected}
      options={options}
      onChange={(opt) => onChangeId(opt?.id ?? "")}
    />
  );
}

export function RoomPicker({
  catalog,
  valueId,
  onChangeId,
  label = "Sala",
}: {
  catalog: PlaygroundCatalog | null;
  valueId: string;
  onChangeId: (id: string) => void;
  label?: string;
}) {
  const options: EntityOption[] = useMemo(
    () =>
      (catalog?.rooms ?? []).map((r) => ({
        id: r.id,
        label: r.name,
      })),
    [catalog]
  );

  const selected = options.find((o) => o.id === valueId) ?? null;

  return (
    <EntityCombobox
      label={label}
      placeholder="Selecionar sala..."
      value={selected}
      options={options}
      onChange={(opt) => onChangeId(opt?.id ?? "")}
    />
  );
}
