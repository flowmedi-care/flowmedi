"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { BUILTIN_GOAL_DEFINITIONS } from "@/lib/attendance-flow/defaults";
import type { AppointmentPolicy, GoalPolicyLevel } from "@/lib/attendance-flow/types";
import { saveAppointmentPolicy } from "./actions";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";

const POLICY_GOALS = BUILTIN_GOAL_DEFINITIONS.filter(
  (g) => !g.is_mutation && !g.id.startsWith("cancel")
);

export function AgendamentoPolicyClient({
  initialPolicy,
}: {
  initialPolicy: AppointmentPolicy;
}) {
  const [goals, setGoals] = useState<Record<string, GoalPolicyLevel>>(initialPolicy.goals);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await saveAppointmentPolicy(goals);
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else toast("Política de atendimento salva.", "success");
  }

  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "Configurações", href: "/dashboard/configuracoes" },
          { label: "Agendamento" },
        ],
        title: "Política de Atendimento",
        description:
          "Regras de negócio por objetivo — afetam WhatsApp, portal e recepção.",
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Objetivos do agendamento</CardTitle>
          <CardDescription>
            Defina se cada objetivo é ignorado, opcional ou obrigatório antes de confirmar
            (modo estrito). A ordem das perguntas é configurada em{" "}
            <Link href="/dashboard/configuracoes/assistente-virtual" className="text-primary hover:underline">
              Assistente Virtual → Fluxos Conversacionais
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {POLICY_GOALS.map((goal) => (
            <div
              key={goal.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-border last:border-0"
            >
              <div>
                <p className="font-medium text-sm">{goal.label}</p>
                <p className="text-xs text-muted-foreground">{goal.id}</p>
              </div>
              <div className="flex gap-4 text-sm">
                {(["ignore", "optional", "required"] as const).map((level) => (
                  <label key={level} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`policy-${goal.id}`}
                      checked={(goals[goal.id] ?? goal.default_policy ?? "optional") === level}
                      onChange={() => setGoals((g) => ({ ...g, [goal.id]: level }))}
                    />
                    {level === "ignore" ? "Ignorar" : level === "optional" ? "Opcional" : "Obrigatório"}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar política"}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
