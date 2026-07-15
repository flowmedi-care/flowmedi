"use client";

import type { CapabilityFormProps } from "@/lib/assistant-capabilities/types";
import type { GeneralSettings } from "@/lib/assistant-capabilities/general/types";
import { ComingSoon } from "./coming-soon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function GeneralCapabilityForm({
  value,
  onChange,
  disabled,
}: CapabilityFormProps<GeneralSettings>) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold">Personalidade</h3>
        <div className="space-y-3">
          <div>
            <Label>Nome da IA</Label>
            <Input
              disabled={disabled}
              value={value.assistantName}
              onChange={(e) => onChange({ ...value, assistantName: e.target.value })}
            />
          </div>
          <div>
            <Label>Tom</Label>
            <Select
              disabled={disabled}
              value={value.tone}
              onChange={(e) =>
                onChange({
                  ...value,
                  tone: e.target.value === "formal" ? "formal" : "informal",
                })
              }
            >
              <option value="informal">Informal</option>
              <option value="formal">Formal</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.useEmojis}
              onChange={(e) => onChange({ ...value, useEmojis: e.target.checked })}
            />
            Usar emojis
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Atendimento</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.transferToHuman}
              onChange={(e) => onChange({ ...value, transferToHuman: e.target.checked })}
            />
            Transferir para humano
          </label>
          <div>
            <Label>Tempo médio de espera (texto)</Label>
            <Input
              disabled={disabled}
              value={value.avgWaitTime}
              onChange={(e) => onChange({ ...value, avgWaitTime: e.target.value })}
              placeholder="Ex.: cerca de 15 minutos"
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Funcionamento</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Início</Label>
            <Input
              type="time"
              disabled={disabled}
              value={value.botActiveStart}
              onChange={(e) => onChange({ ...value, botActiveStart: e.target.value })}
            />
          </div>
          <div>
            <Label>Fim</Label>
            <Input
              type="time"
              disabled={disabled}
              value={value.botActiveEnd}
              onChange={(e) => onChange({ ...value, botActiveEnd: e.target.value })}
            />
          </div>
        </div>
        <ComingSoon
          title="Em breve"
          items={[
            { id: "days", label: "Dias da semana" },
            { id: "tz", label: "Fuso horário da clínica" },
          ]}
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Avançado</h3>
        <div>
          <Label>Aguardar antes de responder (segundos)</Label>
          <Input
            type="number"
            min={2}
            max={30}
            disabled={disabled}
            value={value.debounceSeconds}
            onChange={(e) =>
              onChange({
                ...value,
                debounceSeconds: Math.min(30, Math.max(2, Number(e.target.value) || 5)),
              })
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Espera o paciente terminar de digitar mensagens em sequência.
          </p>
        </div>
      </section>
    </div>
  );
}
