"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AgentUnifiedPipelineCanvas } from "@/components/agents/agent-unified-pipeline-canvas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  AGENT_PIPELINE_STAGES,
  MUTATING_TOOL_NAMES,
  buildDefaultToolExecutionModes,
  mergeToolExecutionModes,
  type ToolExecutionMode,
  type ToolExecutionModesConfig,
} from "@/lib/virtual-assistant/agent-pipeline";
import { ASSISTANT_TOOL_CATALOG } from "@/lib/virtual-assistant/tools/catalog";
import { useConversationPipeline } from "@/hooks/use-conversation-pipeline";
import { saveVirtualAssistantSettings } from "./actions";

type PipelineDisplayMode = "reference" | "conversation";

type ConversationOption = {
  id: string;
  phone_number: string;
  contact_name: string | null;
};

type Props = {
  initialToolModes?: ToolExecutionModesConfig | null;
};

export function AssistenteVirtualPipelineTab({ initialToolModes }: Props) {
  const [toolModes, setToolModes] = useState<ToolExecutionModesConfig>(
    mergeToolExecutionModes(initialToolModes)
  );
  const [saving, setSaving] = useState(false);
  const [displayMode, setDisplayMode] = useState<PipelineDisplayMode>("reference");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  const { data: pipelineState, loading: loadingPipeline, refresh } = useConversationPipeline(
    displayMode === "conversation" ? conversationId : null,
    { pollIntervalMs: displayMode === "conversation" && conversationId ? 30_000 : 0 }
  );

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const res = await fetch("/api/whatsapp/conversations?status=open");
      const json = (await res.json()) as ConversationOption[] | { error?: string };
      if (!res.ok || !Array.isArray(json)) {
        toast("Erro ao carregar conversas", "error");
        return;
      }
      setConversations(json.slice(0, 50));
    } catch {
      toast("Falha ao carregar conversas", "error");
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    if (displayMode === "conversation") void loadConversations();
  }, [displayMode, loadConversations]);

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

  const selectedConversation = conversations.find((c) => c.id === conversationId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mapa do pipeline do agente</CardTitle>
          <CardDescription>
            Visualização estilo n8n: etapas CRM, ferramentas e transições. Somente leitura — a
            configuração do fluxo é definida pelo código do agente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex rounded-lg border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setDisplayMode("reference");
                  setConversationId(null);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  displayMode === "reference"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mapa completo
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode("conversation")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  displayMode === "conversation"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Conversa específica
              </button>
            </div>

            {displayMode === "conversation" && (
              <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[200px]">
                <Label htmlFor="pipeline-conversation" className="sr-only">
                  Conversa
                </Label>
                <select
                  id="pipeline-conversation"
                  className="flex-1 min-w-[180px] rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={conversationId ?? ""}
                  onChange={(e) => setConversationId(e.target.value || null)}
                  disabled={loadingConversations}
                >
                  <option value="">
                    {loadingConversations ? "Carregando…" : "Selecione uma conversa"}
                  </option>
                  {conversations.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contact_name ?? c.phone_number} ({c.phone_number})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => void refresh()}
                  disabled={!conversationId || loadingPipeline}
                  aria-label="Atualizar pipeline"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingPipeline ? "animate-spin" : ""}`} />
                </Button>
              </div>
            )}
          </div>

          {displayMode === "conversation" && selectedConversation && pipelineState && (
            <p className="text-xs text-muted-foreground">
              Etapa atual:{" "}
              <strong>{pipelineState.currentStage ?? "—"}</strong>
              {pipelineState.currentStageEnteredAt && (
                <>
                  {" "}
                  · desde{" "}
                  {new Date(pipelineState.currentStageEnteredAt).toLocaleString("pt-BR")}
                </>
              )}
              {pipelineState.visitedStages.length > 0 && (
                <> · trilha: {pipelineState.visitedStages.join(" → ")}</>
              )}
            </p>
          )}

          {displayMode === "conversation" && !conversationId && (
            <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3">
              Selecione uma conversa para ver a etapa atual destacada e o caminho percorrido
              (verde).
            </p>
          )}

          <AgentUnifiedPipelineCanvas
            key={displayMode}
            canvasViewMode={displayMode}
            initialJourneyMode={displayMode === "reference" ? "full" : "active"}
            disableDemoCycle
            currentStage={pipelineState?.currentStage ?? null}
            parallelStages={pipelineState?.parallelStages ?? []}
            visitedStages={pipelineState?.visitedStages ?? []}
            stageHistory={pipelineState?.stageHistory ?? []}
            currentStageEnteredAt={pipelineState?.currentStageEnteredAt ?? null}
            lastToolName={pipelineState?.lastToolName ?? null}
            toolModes={toolModes}
            variant="full"
            showLegend={displayMode === "reference"}
            className="h-[1000px]"
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
