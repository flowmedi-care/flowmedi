"use client";

import { useState } from "react";
import { AgentUnifiedPipelineCanvas } from "@/components/agents/agent-unified-pipeline-canvas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  AGENT_PIPELINE_STAGES,
  type AgentPipelineStage,
  MUTATING_TOOL_NAMES,
  buildDefaultToolExecutionModes,
  mergeToolExecutionModes,
  type ToolExecutionMode,
  type ToolExecutionModesConfig,
} from "@/lib/virtual-assistant/agent-pipeline";
import { ASSISTANT_TOOL_CATALOG } from "@/lib/virtual-assistant/tools/catalog";
import { saveVirtualAssistantSettings } from "./actions";

const DEMO_STAGES: { id: AgentPipelineStage; label: string }[] = AGENT_PIPELINE_STAGES.filter(
  (s) => s.kind === "main"
).map((s) => ({ id: s.code, label: s.shortLabel }));

type Props = {
  initialToolModes?: ToolExecutionModesConfig | null;
};

export function AssistenteVirtualPipelineTab({ initialToolModes }: Props) {
  const [toolModes, setToolModes] = useState<ToolExecutionModesConfig>(
    mergeToolExecutionModes(initialToolModes)
  );
  const [saving, setSaving] = useState(false);
  const [demoStage, setDemoStage] = useState<AgentPipelineStage | null>("agendamento");

  const mutatingCatalog = ASSISTANT_TOOL_CATALOG.filter((t) =>
    (MUTATING_TOOL_NAMES as readonly string[]).includes(t.name)
  );

  function setToolMode(toolName: string, mode: ToolExecutionMode) {
    setToolModes((prev) => ({ ...prev, [toolName]: mode }));
  }

  async function handleSaveModes() {
    setSaving(true);
    const result = await saveVirtualAssistantSettings({ tool_execution_modes: toolModes });
    setSaving(false);
    if (result.error) toast(result.error, "error");
    else toast("Modos de confirmação salvos.", "success");
  }

  function handleResetModes() {
    setToolModes(buildDefaultToolExecutionModes());
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mapa unificado do pipeline</CardTitle>
          <CardDescription>
            Fluxo completo conectado: Mensagem → Roteador → Agente → Jornada → Etapas CRM →
            Ferramentas → Resposta. Clique numa etapa para expandir tools e ver dependências.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Label className="w-full text-xs text-muted-foreground">Simular etapa:</Label>
            {DEMO_STAGES.map((s) => (
              <Button
                key={s.id}
                type="button"
                size="sm"
                variant={demoStage === s.id ? "default" : "outline"}
                onClick={() => setDemoStage(s.id)}
              >
                {s.label}
              </Button>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => setDemoStage(null)}>
              Limpar
            </Button>
          </div>
          <AgentUnifiedPipelineCanvas
            demoStage={demoStage}
            toolModes={toolModes}
            variant="full"
            showLegend
            className="h-[700px]"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Confirmação por ferramenta</CardTitle>
          <CardDescription>
            Padrão: automático. Em &quot;Pedir confirmação&quot;, a IA pergunta sim/não ao paciente
            antes de executar a ferramenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {mutatingCatalog.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{tool.label}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{tool.name}</p>
                </div>
                <select
                  className="rounded-md border bg-background px-2 py-1 text-xs"
                  value={toolModes[tool.name] ?? "auto"}
                  onChange={(e) =>
                    setToolMode(tool.name, e.target.value as ToolExecutionMode)
                  }
                >
                  <option value="auto">Automático</option>
                  <option value="human_confirm">Pedir confirmação</option>
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleSaveModes} disabled={saving}>
              {saving ? "Salvando…" : "Salvar modos"}
            </Button>
            <Button type="button" variant="outline" onClick={handleResetModes}>
              Restaurar padrão (automático)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Etapas e regras</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {AGENT_PIPELINE_STAGES.map((stage) => (
              <div key={stage.code} className="rounded-lg border p-3 text-sm">
                <p className="font-semibold">{stage.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{stage.description}</p>
                <p className="text-[10px] mt-2 text-muted-foreground">
                  Leitura: {stage.readTools.join(", ") || "—"}
                </p>
                {stage.mutatingTools.length > 0 && (
                  <p className="text-[10px] text-amber-700">
                    Mutáveis: {stage.mutatingTools.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
