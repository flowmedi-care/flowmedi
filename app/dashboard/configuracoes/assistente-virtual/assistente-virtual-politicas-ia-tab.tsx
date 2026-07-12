"use client";

import { useState, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { BUILTIN_GOAL_DEFINITIONS } from "@/lib/attendance-flow/defaults";
import type { AppointmentPolicy, GoalDefinition, GoalPolicyLevel } from "@/lib/attendance-flow/types";
import { saveAppointmentPolicy } from "../agendamento/actions";

/** Domain sections for Políticas da IA (not flow phase labels). */
const POLICY_SECTIONS: { id: string; label: string; goalIds: string[] | null }[] = [
  {
    id: "cadastro",
    label: "Cadastro do paciente",
    goalIds: ["patient_identified", "cpf", "email", "guardian"],
  },
  {
    id: "agendamento",
    label: "Agendamento",
    goalIds: ["doctor_selected", "procedure_selected", "slot_selected"],
  },
  {
    id: "cancelamento",
    label: "Cancelamento",
    goalIds: ["appointment_selected", "cancel_reason"],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    goalIds: ["insurance", "payment_method"],
  },
  {
    id: "orcamentos",
    label: "Orçamentos",
    goalIds: null,
  },
];

const goalsById = new Map(BUILTIN_GOAL_DEFINITIONS.map((g) => [g.id, g]));

function GoalPolicyRow({
  goal,
  level,
  onChange,
}: {
  goal: GoalDefinition;
  level: GoalPolicyLevel;
  onChange: (level: GoalPolicyLevel) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-border last:border-0">
      <div>
        <p className="font-medium text-sm">{goal.label}</p>
        <p className="text-xs text-muted-foreground">{goal.id}</p>
      </div>
      <div className="flex gap-4 text-sm">
        {(["ignore", "optional", "required"] as const).map((opt) => (
          <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`policy-${goal.id}`}
              checked={level === opt}
              onChange={() => onChange(opt)}
            />
            {opt === "ignore" ? "Ignorar" : opt === "optional" ? "Opcional" : "Obrigatório"}
          </label>
        ))}
      </div>
    </div>
  );
}

export function AssistenteVirtualPoliticasIaTab({
  initialPolicy,
  operationalSlot,
}: {
  initialPolicy: AppointmentPolicy;
  operationalSlot: ReactNode;
}) {
  const [goals, setGoals] = useState<Record<string, GoalPolicyLevel>>(initialPolicy.goals);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await saveAppointmentPolicy(goals);
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else toast("Políticas da IA salvas.", "success");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Políticas da IA</CardTitle>
          <CardDescription>
            Defina se cada objetivo é ignorado, opcional ou obrigatório. A ordem das perguntas fica
            em Fluxos Conversacionais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {POLICY_SECTIONS.map((section) => (
            <div key={section.id}>
              <h3 className="text-sm font-semibold mb-2">{section.label}</h3>
              {section.goalIds == null ? (
                <p className="text-sm text-muted-foreground py-2">
                  Em breve — políticas específicas de orçamento.
                </p>
              ) : (
                <div className="space-y-1">
                  {section.goalIds.map((id) => {
                    const goal = goalsById.get(id);
                    if (!goal) return null;
                    const level =
                      goals[id] ?? (goal.default_policy as GoalPolicyLevel) ?? "optional";
                    return (
                      <GoalPolicyRow
                        key={id}
                        goal={goal}
                        level={level}
                        onChange={(next) => setGoals((g) => ({ ...g, [id]: next }))}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar políticas da IA"}
          </Button>
        </CardContent>
      </Card>

      {operationalSlot}
    </div>
  );
}
