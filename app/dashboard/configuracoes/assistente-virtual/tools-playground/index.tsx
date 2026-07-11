"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Play, Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import type { ToolDefinition } from "@/lib/virtual-assistant/openai-client";
import {
  ASSISTANT_TOOL_CATALOG,
  ASSISTANT_TOOL_CATALOG_BY_CATEGORY,
  ASSISTANT_TOOL_CATEGORY_LABELS,
} from "@/lib/virtual-assistant/tools/catalog";
import type { PlaygroundPreset } from "@/lib/virtual-assistant/tools/playground-presets";
import { ToolSidebar } from "./tool-sidebar";
import { ContextPanel } from "./context-panel";
import { ConversationStateEditor } from "./conversation-state-editor";
import { ToolParamsForm } from "./tool-params-form";
import { BookingSlotPicker } from "./booking-slot-picker";
import { ExecutionPipeline } from "./execution-pipeline";
import { ExecutionHistory } from "./execution-history";
import { PresetsBar } from "./presets-bar";
import { FlowDebuggerPanel } from "./flow-debugger-panel";
import { usePlaygroundCatalog, usePhoneContext } from "./hooks/use-playground-catalog";
import {
  usePlaygroundHistory,
  type PlaygroundHistoryEntry,
} from "./hooks/use-playground-history";
import {
  buildArgsFromForm,
  CHATBOT_TOOL_SET,
  formatJson,
  JsonSchemaProperty,
  MUTATING_TOOLS,
} from "./utils";

type ExecuteResponse = {
  ok?: boolean;
  toolName: string;
  durationMs: number;
  result: unknown;
  handoff: boolean;
  statePatch: Record<string, unknown> | null;
  conversationId: string;
  error?: string;
  debug?: PlaygroundHistoryEntry["debug"];
};

interface Props {
  toolDefinitions: ToolDefinition[];
}

function getToolDef(definitions: ToolDefinition[], name: string) {
  return definitions.find((t) => t.function.name === name);
}

export function ToolsPlayground({ toolDefinitions }: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | import("@/lib/virtual-assistant/tools/catalog").AssistantToolCategory>("all");
  const [selectedTool, setSelectedTool] = useState(ASSISTANT_TOOL_CATALOG[0]?.name ?? "list_doctors");
  const [executorMode, setExecutorMode] = useState<"production" | "full">("production");
  const [phone, setPhone] = useState("5511999999999");
  const [conversationId, setConversationId] = useState("");
  const [aiState, setAiState] = useState<Record<string, unknown>>({});
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ExecuteResponse | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | undefined>();

  const { catalog, loading: catalogLoading } = usePlaygroundCatalog();
  const { context, loading: contextLoading } = usePhoneContext(phone);
  const { history, addEntry, clearHistory } = usePlaygroundHistory();

  const catalogEntry = ASSISTANT_TOOL_CATALOG.find((t) => t.name === selectedTool);
  const toolDef = getToolDef(toolDefinitions, selectedTool);
  const isMutating = MUTATING_TOOLS.has(selectedTool);

  const schemaParams = useMemo(() => {
    if (!toolDef) return { properties: {} as Record<string, JsonSchemaProperty>, required: [] as string[] };
    const params = toolDef.function.parameters as {
      properties?: Record<string, JsonSchemaProperty>;
      required?: string[];
    };
    return {
      properties: params.properties ?? {},
      required: params.required ?? [],
    };
  }, [toolDef]);

  function selectTool(name: string) {
    setSelectedTool(name);
    setFormValues({});
    setLastResult(null);
  }

  function restoreFromEntry(entry: PlaygroundHistoryEntry, execute = false) {
    setSelectedTool(entry.toolName);
    setPhone(entry.phone);
    setConversationId(entry.conversationId);
    setExecutorMode(entry.executorMode);
    setAiState(entry.aiStateBefore);
    setFormValues(entry.formValues);
    setLastResult(null);
    if (execute) void runExecution(entry);
  }

  async function runExecution(
    override?: Partial<PlaygroundHistoryEntry> & {
      args?: Record<string, unknown>;
      silent?: boolean;
    }
  ): Promise<ExecuteResponse | null> {
    const tool = override?.toolName ?? selectedTool;
    const phoneVal = override?.phone ?? phone;
    const convId = override?.conversationId ?? conversationId;
    const mode = override?.executorMode ?? executorMode;
    const state = override?.aiStateBefore ?? aiState;
    const forms = override?.formValues ?? formValues;
    const def = getToolDef(toolDefinitions, tool);

    if (!phoneVal.trim()) {
      toast("Informe o telefone de contexto", "error");
      return null;
    }

    if (mode === "production" && !CHATBOT_TOOL_SET.has(tool)) {
      toast("Ferramenta não disponível no modo produção", "error");
      return null;
    }

    const mutating = MUTATING_TOOLS.has(tool);
    if (mutating && !override?.silent) {
      const label = ASSISTANT_TOOL_CATALOG.find((t) => t.name === tool)?.label ?? tool;
      const ok = confirm(
        `A ferramenta "${label}" altera dados reais no sistema.\n\nTelefone: ${phoneVal}\n\nDeseja continuar?`
      );
      if (!ok) return null;
    }

    const formArgs = buildArgsFromForm(
      def
        ? ((def.function.parameters as { properties?: Record<string, JsonSchemaProperty> }).properties ?? {})
        : {},
      forms
    );
    const args = override?.args ? { ...formArgs, ...override.args } : formArgs;

    const required =
      def
        ? ((def.function.parameters as { required?: string[] }).required ?? [])
        : [];
    const missing = required.filter((key) => {
      const val = args[key];
      return val === undefined || val === null || val === "";
    });
    if (missing.length > 0 && !override?.args) {
      toast(`Campos obrigatórios: ${missing.join(", ")}`, "error");
      return null;
    }

    setRunning(true);
    try {
      const res = await fetch("/api/whatsapp/assistant/execute-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: tool,
          args,
          phone: phoneVal.trim(),
          conversationId: convId.trim() || undefined,
          aiState: state,
          confirmMutating: mutating,
          executorMode: mode,
          debug: true,
        }),
      });
      const json = (await res.json()) as ExecuteResponse & { requiresConfirmation?: boolean };
      if (!res.ok) {
        toast(json.error ?? "Erro ao executar ferramenta", "error");
        return null;
      }

      setLastResult(json);
      if (json.conversationId && !convId) setConversationId(json.conversationId);
      if (json.debug?.aiStateAfter) {
        setAiState(json.debug.aiStateAfter as Record<string, unknown>);
      } else if (json.statePatch && Object.keys(json.statePatch).length > 0) {
        setAiState({ ...state, ...json.statePatch });
      }

      if (override?.formValues) setFormValues(override.formValues);

      addEntry({
        toolName: json.toolName,
        phone: phoneVal,
        conversationId: json.conversationId,
        executorMode: mode,
        args,
        aiStateBefore: state,
        aiStateAfter: (json.debug?.aiStateAfter as Record<string, unknown>) ?? state,
        result: json.result,
        statePatch: json.statePatch,
        durationMs: json.durationMs,
        handoff: json.handoff,
        debug: json.debug,
        formValues: override?.formValues ?? forms,
      });

      if (!override?.silent) {
        toast(`Ferramenta executada em ${json.durationMs}ms`, "success");
      }
      return json;
    } catch {
      toast("Falha ao executar ferramenta", "error");
      return null;
    } finally {
      setRunning(false);
    }
  }

  function applyPreset(preset: PlaygroundPreset) {
    setActivePresetId(preset.id);
    if (preset.toolName) setSelectedTool(preset.toolName);
    if (preset.phone) setPhone(preset.phone);
    if (preset.aiState) setAiState(preset.aiState);
    if (preset.formValues) setFormValues(preset.formValues);
    if (preset.executorMode) setExecutorMode(preset.executorMode);
    setLastResult(null);
  }

  function handleUsePatient() {
    if (!context?.patient?.id) return;
    setFormValues((prev) => ({ ...prev, patient_id: context.patient!.id }));
    setAiState((prev) => ({ ...prev, patient_id: context.patient!.id }));
  }

  function handleLoadConversationState() {
    if (!context?.aiState) return;
    setAiState(context.aiState as Record<string, unknown>);
    if (context.conversationId) setConversationId(context.conversationId);
  }

  const offeredDays = Array.isArray(aiState.offered_days) ? aiState.offered_days : [];
  const booking = aiState.booking as { offered_slots?: unknown[] } | undefined;
  const showBookingPicker =
    selectedTool === "find_available_slots" ||
    selectedTool === "create_appointment" ||
    offeredDays.length > 0 ||
    (booking?.offered_slots?.length ?? 0) > 0 ||
    (lastResult?.toolName === "find_available_slots");

  async function handleFetchDays() {
    await runExecution({
      toolName: "find_available_slots",
      args: {
        doctor_id: formValues.doctor_id,
        procedure_id: formValues.procedure_id,
      },
    });
  }

  async function handleFetchTimesForDay(date: string) {
    const json = await runExecution({
      toolName: "find_available_slots",
      silent: true,
      args: {
        doctor_id: formValues.doctor_id,
        procedure_id: formValues.procedure_id,
        date,
      },
      formValues: { ...formValues, date },
    });
    return json?.result ?? null;
  }

  async function handleLoadMoreDays(skipDays: number) {
    await runExecution({
      toolName: "find_available_slots",
      args: {
        doctor_id: formValues.doctor_id,
        procedure_id: formValues.procedure_id,
        skip_days: skipDays,
      },
      formValues: { ...formValues, skip_days: String(skipDays) },
    });
  }

  async function handleCreateAppointment(
    scheduledAt: string,
    _dayLabel?: string,
    _timeLabel?: string
  ) {
    const patient =
      formValues.patient_id ||
      String(aiState.patient_id ?? "") ||
      context?.patient?.id ||
      "";
    setSelectedTool("create_appointment");
    const nextForms = {
      ...formValues,
      patient_id: patient,
      doctor_id: formValues.doctor_id,
      procedure_id: formValues.procedure_id,
      scheduled_at: scheduledAt,
    };
    setFormValues(nextForms);
    await runExecution({
      toolName: "create_appointment",
      formValues: nextForms,
      args: {
        patient_id: patient,
        doctor_id: formValues.doctor_id,
        procedure_id: formValues.procedure_id,
        scheduled_at: scheduledAt,
      },
    });
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wrench className="h-5 w-5 text-primary" />
                Tool Playground
              </CardTitle>
              <CardDescription className="mt-1 max-w-3xl text-sm leading-relaxed">
                Execute ferramentas manualmente com pickers de entidades, estado visual e pipeline
                de debug INPUT → OUTPUT → PATCH → LOGS.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Select
                value={executorMode}
                onChange={(e) => setExecutorMode(e.target.value as "production" | "full")}
                className="w-48"
              >
                <option value="full">Modo completo (VA)</option>
                <option value="production">Modo produção (chatbot)</option>
              </Select>
              {executorMode === "production" && (
                <p className="text-[10px] text-muted-foreground">12 ferramentas · fluxo conversacional ativo</p>
              )}
              {executorMode === "full" && (
                <p className="text-[10px] text-amber-600">Modo VA ignora política de fluxo</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Somente admin</Badge>
            <Badge variant="outline">Side effects reais</Badge>
            <Badge variant="outline">Logs em whatsapp_ai_tool_log</Badge>
            {catalogLoading && <Badge variant="secondary">Carregando catálogo…</Badge>}
          </div>
          <PresetsBar onApply={applyPreset} activePresetId={activePresetId} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <ToolSidebar
          search={search}
          onSearchChange={setSearch}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          selectedTool={selectedTool}
          onSelectTool={selectTool}
          executorMode={executorMode}
        />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{catalogEntry?.label ?? selectedTool}</CardTitle>
                  <code className="mt-1 block text-xs text-muted-foreground">{selectedTool}</code>
                </div>
                <div className="flex flex-wrap gap-2">
                  {catalogEntry && (
                    <Badge variant="secondary">
                      {ASSISTANT_TOOL_CATEGORY_LABELS[catalogEntry.category]}
                    </Badge>
                  )}
                  {executorMode === "production" && CHATBOT_TOOL_SET.has(selectedTool) && (
                    <Badge variant="outline">Produção</Badge>
                  )}
                  {isMutating && (
                    <Badge variant="warning" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Altera dados
                    </Badge>
                  )}
                </div>
              </div>
              {catalogEntry && (
                <CardDescription className="mt-2 space-y-1">
                  <p>{catalogEntry.description}</p>
                  <p className="text-xs">
                    <span className="font-medium text-foreground/80">Quando a IA usa:</span>{" "}
                    {catalogEntry.whenToUse}
                  </p>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <ContextPanel
                phone={phone}
                onPhoneChange={setPhone}
                conversationId={conversationId}
                onConversationIdChange={setConversationId}
                context={context}
                contextLoading={contextLoading}
                onUsePatient={handleUsePatient}
                onLoadConversationState={handleLoadConversationState}
              />

              <ConversationStateEditor
                value={aiState}
                onChange={setAiState}
                catalog={catalog}
                appointments={context?.appointments}
              />

              <FlowDebuggerPanel
                conversationFlow={(() => {
                  const after = lastResult?.debug?.aiStateAfter as Record<string, unknown> | undefined;
                  const cf = after?.conversation_flow ?? aiState.conversation_flow;
                  return cf as import("@/lib/attendance-flow/types").ConversationFlowState | undefined;
                })()}
                workflowLabel={String(
                  (
                    (lastResult?.debug?.aiStateAfter as Record<string, unknown> | undefined)
                      ?.conversation_flow as { active_workflow_id?: string } | undefined
                  )?.active_workflow_id ??
                    (aiState.conversation_flow as { active_workflow_id?: string } | undefined)
                      ?.active_workflow_id ??
                    "consulta"
                )}
              />

              {showBookingPicker ? (
                <BookingSlotPicker
                  catalog={catalog}
                  phoneContext={context}
                  aiState={aiState}
                  onAiStateChange={setAiState}
                  formValues={formValues}
                  onFormChange={setFormValues}
                  lastResult={lastResult?.result ?? null}
                  lastToolName={lastResult?.toolName}
                  running={running}
                  onFetchDays={handleFetchDays}
                  onFetchTimesForDay={handleFetchTimesForDay}
                  onLoadMoreDays={handleLoadMoreDays}
                  onCreateAppointment={handleCreateAppointment}
                  showAdvancedParams={selectedTool === "find_available_slots"}
                  advancedParams={
                    <ToolParamsForm
                      properties={schemaParams.properties}
                      required={schemaParams.required}
                      formValues={formValues}
                      onFormChange={setFormValues}
                      catalog={catalog}
                      phoneContext={context}
                      aiState={aiState}
                    />
                  }
                />
              ) : (
                <ToolParamsForm
                  properties={schemaParams.properties}
                  required={schemaParams.required}
                  formValues={formValues}
                  onFormChange={setFormValues}
                  catalog={catalog}
                  phoneContext={context}
                  aiState={aiState}
                />
              )}

              {!showBookingPicker && (
                <Button onClick={() => void runExecution()} disabled={running}>
                  <Play className="mr-2 h-4 w-4" />
                  {running ? "Executando…" : "Executar ferramenta"}
                </Button>
              )}

              {showBookingPicker && selectedTool !== "find_available_slots" && (
                <Button onClick={() => void runExecution()} disabled={running}>
                  <Play className="mr-2 h-4 w-4" />
                  {running ? "Executando…" : "Executar ferramenta"}
                </Button>
              )}
            </CardContent>
          </Card>

          {lastResult && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Resultado</CardTitle>
              </CardHeader>
              <CardContent>
                <ExecutionPipeline
                  toolName={lastResult.toolName}
                  durationMs={lastResult.durationMs}
                  handoff={lastResult.handoff}
                  result={lastResult.result}
                  statePatch={lastResult.statePatch}
                  debug={lastResult.debug}
                  conversationId={lastResult.conversationId}
                />
              </CardContent>
            </Card>
          )}

          <ExecutionHistory
            history={history}
            onRerun={(e) => restoreFromEntry(e, true)}
            onDuplicate={(e) => restoreFromEntry(e, false)}
            onClear={clearHistory}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Referência por categoria</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ASSISTANT_TOOL_CATALOG_BY_CATEGORY.map((group) => (
            <div key={group.category} className="rounded-lg border p-3">
              <p className="text-sm font-semibold">{group.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{group.tools.length} ferramentas</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export { formatJson };
