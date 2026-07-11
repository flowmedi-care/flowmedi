"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  DEFAULT_CONVERSATION_FLOWS,
  mergeConversationFlows,
} from "@/lib/attendance-flow/defaults";
import { defaultGoalRegistry } from "@/lib/attendance-flow/goal-registry";
import type { ConversationFlowsConfig, WorkflowDefinition, WorkflowMode } from "@/lib/attendance-flow/types";
import { saveConversationFlows } from "./flows-actions";

const WORKFLOW_TABS = [
  { id: "consulta", label: "Consulta" },
  { id: "cancelamento", label: "Cancelamento" },
  { id: "exame", label: "Exame (em breve)" },
  { id: "teleconsulta", label: "Teleconsulta (em breve)" },
];

export function AssistenteVirtualFlowsTab({
  initialFlows,
}: {
  initialFlows: ConversationFlowsConfig;
}) {
  const [flows, setFlows] = useState(() => mergeConversationFlows(initialFlows));
  const [activeWf, setActiveWf] = useState("consulta");
  const [saving, setSaving] = useState(false);

  const workflow = flows.workflows[activeWf] ?? DEFAULT_CONVERSATION_FLOWS.workflows.consulta;

  const goalsWithMeta = useMemo(() => {
    return workflow.goal_ids.map((id) => {
      const goal = defaultGoalRegistry.get(id);
      const phase = workflow.phases?.find((p) => p.goal_ids.includes(id));
      return {
        id,
        label: goal?.label ?? id,
        priority: workflow.priority_overrides?.[id] ?? goal?.priority ?? 0,
        phaseLabel: phase?.label ?? "—",
      };
    });
  }, [workflow]);

  function updateWorkflow(patch: Partial<WorkflowDefinition>) {
    setFlows((prev) => ({
      workflows: {
        ...prev.workflows,
        [activeWf]: { ...prev.workflows[activeWf], ...patch, id: activeWf },
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    const res = await saveConversationFlows(flows.workflows);
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else toast("Fluxos conversacionais salvos.", "success");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fluxos Conversacionais</CardTitle>
          <CardDescription>
            Ordem visual e modo por tipo de atendimento. Regras de negócio em{" "}
            <Link href="/dashboard/configuracoes/agendamento" className="text-primary hover:underline">
              Configurações → Agendamento
            </Link>
            . Fases agrupam objetivos apenas na UI — o motor usa prioridade e pendências.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {WORKFLOW_TABS.map((t) => (
              <Button
                key={t.id}
                type="button"
                variant={activeWf === t.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveWf(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
            <div>
              <Label>Modo deste workflow</Label>
              <Select
                value={workflow.mode}
                onChange={(e) => updateWorkflow({ mode: e.target.value as WorkflowMode })}
              >
                <option value="express">Express — agenda rápido, secretária complementa</option>
                <option value="assisted">Assistido — pergunta tudo que der</option>
                <option value="strict">Estrito — bloqueia sem dados obrigatórios</option>
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={workflow.enabled !== false}
                  onChange={(e) => updateWorkflow({ enabled: e.target.checked })}
                />
                Workflow habilitado
              </label>
            </div>
          </div>

          <div className="border rounded-lg divide-y">
            {workflow.phases?.map((phase) => (
              <div key={phase.id} className="p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {phase.label}
                </p>
                <ul className="space-y-1">
                  {phase.goal_ids.map((gid) => {
                    const meta = goalsWithMeta.find((g) => g.id === gid);
                    if (!meta) return null;
                    return (
                      <li key={gid} className="flex items-center justify-between text-sm py-1">
                        <span>{meta.label}</span>
                        <span className="text-xs text-muted-foreground">prioridade {meta.priority}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Preview: {workflow.label} · modo {workflow.mode} · {workflow.goal_ids.length} objetivos
          </p>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar fluxos"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
