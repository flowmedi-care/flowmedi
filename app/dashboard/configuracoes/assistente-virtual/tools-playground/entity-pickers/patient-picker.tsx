"use client";

import { useCallback, useState } from "react";
import { EntityCombobox, type EntityOption } from "./entity-combobox";

export function PatientPicker({
  valueId,
  onChangeId,
  label = "Paciente",
}: {
  valueId: string;
  onChangeId: (id: string) => void;
  label?: string;
}) {
  const [selected, setSelected] = useState<EntityOption | null>(
    valueId ? { id: valueId, label: valueId.slice(0, 8) + "…" } : null
  );
  const [options, setOptions] = useState<EntityOption[]>([]);

  const onSearch = useCallback(async (query: string) => {
    const res = await fetch(
      `/api/patients/search?all=1${query ? `&q=${encodeURIComponent(query)}` : ""}`
    );
    const json = await res.json();
    if (res.ok) {
      setOptions(
        (json.contacts ?? []).map(
          (c: { id: string; full_name: string | null; phone?: string }) => ({
            id: c.id,
            label: c.full_name ?? "Sem nome",
            sublabel: c.phone,
          })
        )
      );
    }
  }, []);

  return (
    <EntityCombobox
      label={label}
      placeholder="Buscar paciente por nome..."
      value={selected}
      options={options}
      onSearch={onSearch}
      onChange={(opt) => {
        setSelected(opt);
        onChangeId(opt?.id ?? "");
      }}
    />
  );
}
