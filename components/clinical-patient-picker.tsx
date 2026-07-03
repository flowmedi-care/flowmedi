"use client";

import { Button } from "@/components/ui/button";
import { PatientCombobox, type PatientOption } from "@/components/patient-combobox";

export function ClinicalPatientPicker({
  value,
  onChange,
  onConfirm,
  onCancel,
  confirmLabel = "Continuar",
}: {
  value: PatientOption | null;
  onChange: (patient: PatientOption | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}) {
  return (
    <div className="space-y-4 max-w-md">
      <p className="text-sm text-muted-foreground">
        Selecione o paciente para emitir o documento. O registro ficará vinculado ao paciente
        (sem consulta na agenda).
      </p>
      <PatientCombobox
        value={value}
        onChange={onChange}
        label="Paciente *"
        placeholder="Buscar por nome ou telefone..."
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={onConfirm} disabled={!value?.id}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
