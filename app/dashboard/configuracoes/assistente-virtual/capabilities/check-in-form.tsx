"use client";

import type { CapabilityFormProps } from "@/lib/assistant-capabilities/types";
import type { CheckInSettings } from "@/lib/assistant-capabilities/check-in/types";
import { ComingSoon } from "./coming-soon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CheckInCapabilityForm({
  value,
  onChange,
  disabled,
}: CapabilityFormProps<CheckInSettings>) {
  const off = disabled || !value.enabled;

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={value.enabled}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        Permitir check-in pelo WhatsApp
      </label>

      <section className={off ? "pointer-events-none opacity-50" : undefined}>
        <h3 className="mb-3 text-sm font-semibold">Disponibilidade</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Abrir (horas antes)</Label>
            <Input
              type="number"
              min={0}
              max={72}
              disabled={off}
              value={value.opensBeforeHours}
              onChange={(e) =>
                onChange({
                  ...value,
                  opensBeforeHours: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </div>
          <div>
            <Label>Encerrar (minutos após o horário)</Label>
            <Input
              type="number"
              min={0}
              max={240}
              disabled={off}
              value={value.closesAfterMinutes}
              onChange={(e) =>
                onChange({
                  ...value,
                  closesAfterMinutes: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </div>
        </div>
      </section>

      <section className={off ? "pointer-events-none opacity-50" : undefined}>
        <h3 className="mb-3 text-sm font-semibold">Quando indisponível</h3>
        <div className="space-y-2 text-sm">
          {(
            [
              ["show_next_eligible", "Informar quando poderá fazer check-in"],
              ["closed_only", "Apenas informar que ainda não está disponível"],
            ] as const
          ).map(([id, label]) => (
            <label key={id} className="flex items-center gap-2">
              <input
                type="radio"
                name="whenUnavailable"
                disabled={off}
                checked={value.behavior.whenUnavailable === id}
                onChange={() =>
                  onChange({
                    ...value,
                    behavior: { ...value.behavior, whenUnavailable: id },
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className={off ? "pointer-events-none opacity-50" : undefined}>
        <h3 className="mb-3 text-sm font-semibold">Após o check-in</h3>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="afterCheckIn"
              disabled={off}
              checked={value.behavior.afterCheckIn === "confirm_patient_only"}
              onChange={() =>
                onChange({
                  ...value,
                  behavior: {
                    ...value.behavior,
                    afterCheckIn: "confirm_patient_only",
                  },
                })
              }
            />
            Apenas confirmar ao paciente
          </label>
          <label
            className="flex cursor-not-allowed items-center gap-2 text-muted-foreground opacity-70"
            title="Disponível em breve"
          >
            <input type="radio" name="afterCheckIn" disabled checked={false} />
            Avisar a recepção
          </label>
        </div>
      </section>

      <ComingSoon
        items={[
          { id: "docs", label: "Solicitar documentos" },
          { id: "presence", label: "Confirmar presença" },
        ]}
      />
    </div>
  );
}
