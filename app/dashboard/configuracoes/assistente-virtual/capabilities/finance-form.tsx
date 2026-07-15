"use client";

import type { CapabilityFormProps } from "@/lib/assistant-capabilities/types";
import type { FinanceSettings } from "@/lib/assistant-capabilities/finance/types";
import type { GoalPolicyLevel } from "@/lib/attendance-flow/types";
import { ComingSoon } from "./coming-soon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LevelRadios({
  name,
  label,
  value,
  onChange,
  disabled,
}: {
  name: string;
  label: string;
  value: GoalPolicyLevel;
  onChange: (v: GoalPolicyLevel) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-4 text-sm">
        {(["ignore", "optional", "required"] as const).map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name={name}
              disabled={disabled}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt === "ignore" ? "Ignorar" : opt === "optional" ? "Opcional" : "Obrigatório"}
          </label>
        ))}
      </div>
    </div>
  );
}

export function FinanceCapabilityForm({
  value,
  onChange,
  disabled,
}: CapabilityFormProps<FinanceSettings>) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold">Cobrança</h3>
        <LevelRadios
          name="insurance"
          label="Convênio"
          value={value.insurance}
          disabled={disabled}
          onChange={(insurance) => onChange({ ...value, insurance })}
        />
        <LevelRadios
          name="paymentMethod"
          label="Forma de pagamento"
          value={value.paymentMethod}
          disabled={disabled}
          onChange={(paymentMethod) => onChange({ ...value, paymentMethod })}
        />
        <div className="mt-3 space-y-3">
          <div>
            <Label>Formas de pagamento (texto livre, separadas por vírgula)</Label>
            <Input
              disabled={disabled}
              value={value.paymentMethodsText}
              onChange={(e) => onChange({ ...value, paymentMethodsText: e.target.value })}
            />
          </div>
          <div>
            <Label>Cancelamento / reembolso</Label>
            <textarea
              disabled={disabled}
              className="w-full min-h-[60px] rounded-md border px-3 py-2 text-sm"
              value={value.cancellationPolicyText}
              onChange={(e) =>
                onChange({ ...value, cancellationPolicyText: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Tempo médio de espera</Label>
            <Input
              disabled={disabled}
              value={value.avgWaitTime}
              onChange={(e) => onChange({ ...value, avgWaitTime: e.target.value })}
            />
          </div>
          <div>
            <Label>Promoções ativas</Label>
            <textarea
              disabled={disabled}
              className="w-full min-h-[60px] rounded-md border px-3 py-2 text-sm"
              value={value.promotionsText}
              onChange={(e) => onChange({ ...value, promotionsText: e.target.value })}
            />
          </div>
        </div>
      </section>

      <ComingSoon title="Negociação" items={[{ id: "nego", label: "IA pode negociar preços" }]} />
      <ComingSoon
        title="Pagamentos"
        items={[
          { id: "pix", label: "PIX" },
          { id: "parc", label: "Parcelamento" },
          { id: "bol", label: "Boletos" },
        ]}
      />
      <ComingSoon
        title="Convênios"
        items={[{ id: "cov", label: "Catálogo e regras de convênio" }]}
      />
    </div>
  );
}
