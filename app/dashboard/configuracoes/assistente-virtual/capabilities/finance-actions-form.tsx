"use client";

import Link from "next/link";
import type { CapabilityFormProps } from "@/lib/assistant-capabilities/types";
import type { FinanceActionSettings } from "@/lib/assistant-capabilities/finance/action-types";

export function FinanceActionsForm({
  value,
  onChange,
  disabled,
}: CapabilityFormProps<FinanceActionSettings>) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Permissões de <strong>ação</strong> financeira. Preços e formas de pagamento são fontes em
        Conhecimento (Serviços / Clínica) — edite o conteúdo nos módulos de origem.
      </p>
      <div className="space-y-2 text-sm">
        {(
          [
            ["allowGenerateQuote", "Gerar orçamento"],
            ["allowSendQuote", "Enviar orçamento"],
            ["allowCalculateQuote", "Calcular orçamento"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Configuração de orçamentos e tabelas:{" "}
        <Link href="/dashboard/vendas/orcamentos" className="text-primary hover:underline">
          Vendas → Orçamentos
        </Link>
        . Mostrar preços: Políticas → Conhecimento → Serviços.
      </p>
    </div>
  );
}
