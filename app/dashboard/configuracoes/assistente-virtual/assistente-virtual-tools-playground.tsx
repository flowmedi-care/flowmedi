"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Play,
  Search,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import type { ToolDefinition } from "@/lib/virtual-assistant/openai-client";
import {
  ASSISTANT_TOOL_CATALOG,
  ASSISTANT_TOOL_CATALOG_BY_CATEGORY,
  ASSISTANT_TOOL_CATEGORY_LABELS,
  type AssistantToolCategory,
} from "@/lib/virtual-assistant/tools/catalog";
import { cn } from "@/lib/utils";

const MUTATING_TOOLS = new Set([
  "register_patient",
  "create_appointment",
  "confirm_appointment",
  "cancel_appointment",
  "reschedule_appointment",
  "create_and_send_quote",
  "resend_form_link",
  "collect_nps_feedback",
  "transfer_to_human",
]);

type JsonSchemaProperty = {
  type?: string;
  description?: string;
  enum?: string[];
  items?: { type?: string };
};

type ToolRunResult = {
  toolName: string;
  durationMs: number;
  result: unknown;
  handoff: boolean;
  statePatch: Record<string, unknown> | null;
  conversationId: string;
  at: string;
};

interface Props {
  toolDefinitions: ToolDefinition[];
}

function getToolDef(definitions: ToolDefinition[], name: string) {
  return definitions.find((t) => t.function.name === name);
}

function buildArgsFromForm(
  toolDef: ToolDefinition | undefined,
  formValues: Record<string, string>
): Record<string, unknown> {
  if (!toolDef) return {};

  const params = toolDef.function.parameters as {
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
  const properties = params.properties ?? {};
  const args: Record<string, unknown> = {};

  for (const [key, schema] of Object.entries(properties)) {
    const raw = formValues[key]?.trim() ?? "";
    if (!raw && schema.type !== "boolean") continue;

    if (schema.type === "boolean") {
      args[key] = formValues[key] === "true";
      continue;
    }
    if (schema.type === "number") {
      const num = Number(raw);
      if (Number.isFinite(num)) args[key] = num;
      continue;
    }
    if (schema.type === "array") {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          args[key] = parsed;
        }
      } catch {
        args[key] = raw.split(",").map((s) => s.trim()).filter(Boolean);
      }
      continue;
    }
    args[key] = raw;
  }

  return args;
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AssistenteVirtualToolsPlayground({ toolDefinitions }: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<AssistantToolCategory | "all">("all");
  const [selectedTool, setSelectedTool] = useState(ASSISTANT_TOOL_CATALOG[0]?.name ?? "list_doctors");
  const [phone, setPhone] = useState("5511999999999");
  const [conversationId, setConversationId] = useState("");
  const [aiStateJson, setAiStateJson] = useState("{}");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ToolRunResult | null>(null);
  const [history, setHistory] = useState<ToolRunResult[]>([]);

  const catalogEntry = ASSISTANT_TOOL_CATALOG.find((t) => t.name === selectedTool);
  const toolDef = getToolDef(toolDefinitions, selectedTool);
  const isMutating = MUTATING_TOOLS.has(selectedTool);

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ASSISTANT_TOOL_CATALOG.filter((tool) => {
      if (categoryFilter !== "all" && tool.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.label.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q)
      );
    });
  }, [search, categoryFilter]);

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

  async function handleExecute() {
    if (!phone.trim()) {
      toast("Informe o telefone de contexto", "error");
      return;
    }

    let aiState: Record<string, unknown> = {};
    if (aiStateJson.trim()) {
      try {
        aiState = JSON.parse(aiStateJson) as Record<string, unknown>;
      } catch {
        toast("JSON do aiState inválido", "error");
        return;
      }
    }

    if (isMutating) {
      const ok = confirm(
        `A ferramenta "${catalogEntry?.label ?? selectedTool}" altera dados reais no sistema.\n\nTelefone: ${phone}\n\nDeseja continuar?`
      );
      if (!ok) return;
    }

    const args = buildArgsFromForm(toolDef, formValues);
    const missing = schemaParams.required.filter((key) => {
      const val = args[key];
      return val === undefined || val === null || val === "";
    });
    if (missing.length > 0) {
      toast(`Campos obrigatórios: ${missing.join(", ")}`, "error");
      return;
    }

    setRunning(true);
    try {
      const res = await fetch("/api/whatsapp/assistant/execute-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: selectedTool,
          args,
          phone: phone.trim(),
          conversationId: conversationId.trim() || undefined,
          aiState,
          confirmMutating: isMutating,
        }),
      });
      const json = (await res.json()) as ToolRunResult & {
        error?: string;
        requiresConfirmation?: boolean;
      };
      if (!res.ok) {
        toast(json.error ?? "Erro ao executar ferramenta", "error");
        return;
      }

      const entry: ToolRunResult = {
        toolName: json.toolName,
        durationMs: json.durationMs,
        result: json.result,
        handoff: json.handoff,
        statePatch: json.statePatch,
        conversationId: json.conversationId,
        at: new Date().toISOString(),
      };
      setLastResult(entry);
      setHistory((prev) => [entry, ...prev].slice(0, 12));
      if (json.statePatch && Object.keys(json.statePatch).length > 0) {
        setAiStateJson(formatJson({ ...aiState, ...json.statePatch }));
      }
      toast(`Ferramenta executada em ${json.durationMs}ms`, "success");
    } catch {
      toast("Falha ao executar ferramenta", "error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5 text-primary" />
            Playground de ferramentas da IA
          </CardTitle>
          <CardDescription className="max-w-3xl text-sm leading-relaxed">
            O assistente virtual <strong>não acessa o banco diretamente</strong> — ele conversa com
            o paciente e a OpenAI decide quando chamar cada uma destas{" "}
            {toolDefinitions.length} ferramentas. Aqui você executa qualquer ferramenta manualmente,
            com o mesmo código usado em produção, para validar parâmetros e respostas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Somente admin</Badge>
          <Badge variant="outline">Usa conversa real por telefone</Badge>
          <Badge variant="outline">Logs em whatsapp_ai_tool_log</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="space-y-3 pb-3">
            <CardTitle className="text-base">Ferramentas</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as AssistantToolCategory | "all")}
            >
              <option value="all">Todas as categorias</option>
              {(Object.keys(ASSISTANT_TOOL_CATEGORY_LABELS) as AssistantToolCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {ASSISTANT_TOOL_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </Select>
          </CardHeader>
          <CardContent className="max-h-[60vh] space-y-1 overflow-y-auto p-2 pt-0">
            {filteredTools.length === 0 ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">Nenhuma ferramenta encontrada.</p>
            ) : (
              filteredTools.map((tool) => (
                <button
                  key={tool.name}
                  type="button"
                  onClick={() => selectTool(tool.name)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    selectedTool === tool.name
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      selectedTool === tool.name ? "opacity-100" : "opacity-40"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{tool.label}</span>
                  {MUTATING_TOOLS.has(tool.name) && (
                    <AlertTriangle
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        selectedTool === tool.name ? "text-primary-foreground/80" : "text-amber-600"
                      )}
                    />
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>

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
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Telefone (contexto da conversa)</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="5511999999999"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Várias ferramentas usam o telefone para buscar paciente e consultas.
                  </p>
                </div>
                <div>
                  <Label>ID da conversa (opcional)</Label>
                  <Input
                    value={conversationId}
                    onChange={(e) => setConversationId(e.target.value)}
                    placeholder="Auto-cria se vazio"
                  />
                </div>
              </div>

              <div>
                <Label>Estado da IA (aiState JSON)</Label>
                <Textarea
                  className="font-mono text-xs"
                  rows={4}
                  value={aiStateJson}
                  onChange={(e) => setAiStateJson(e.target.value)}
                  placeholder='{"patient_id": "...", "doctor_id": "..."}'
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Simula o estado interno da conversa (patient_id, booking_step, etc.). Atualizado
                  automaticamente quando a ferramenta retorna statePatch.
                </p>
              </div>

              {Object.keys(schemaParams.properties).length > 0 ? (
                <div className="space-y-3 rounded-lg border p-4">
                  <p className="text-sm font-medium">Parâmetros da ferramenta</p>
                  {Object.entries(schemaParams.properties).map(([key, schema]) => {
                    const required = schemaParams.required.includes(key);
                    const id = `param-${key}`;

                    if (schema.type === "boolean") {
                      return (
                        <div key={key}>
                          <Label htmlFor={id}>
                            {key}
                            {required && <span className="text-destructive"> *</span>}
                          </Label>
                          <Select
                            id={id}
                            value={formValues[key] ?? ""}
                            onChange={(e) =>
                              setFormValues((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                          >
                            <option value="">—</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </Select>
                          {schema.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{schema.description}</p>
                          )}
                        </div>
                      );
                    }

                    if (schema.enum?.length) {
                      return (
                        <div key={key}>
                          <Label htmlFor={id}>
                            {key}
                            {required && <span className="text-destructive"> *</span>}
                          </Label>
                          <Select
                            id={id}
                            value={formValues[key] ?? ""}
                            onChange={(e) =>
                              setFormValues((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                          >
                            <option value="">—</option>
                            {schema.enum.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </Select>
                          {schema.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{schema.description}</p>
                          )}
                        </div>
                      );
                    }

                    if (schema.type === "array") {
                      return (
                        <div key={key}>
                          <Label htmlFor={id}>
                            {key}
                            {required && <span className="text-destructive"> *</span>}
                          </Label>
                          <Input
                            id={id}
                            value={formValues[key] ?? ""}
                            onChange={(e) =>
                              setFormValues((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder='["uuid-1", "uuid-2"] ou uuid-1, uuid-2'
                          />
                          {schema.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{schema.description}</p>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div key={key}>
                        <Label htmlFor={id}>
                          {key}
                          {required && <span className="text-destructive"> *</span>}
                          {schema.type === "number" && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              (número)
                            </span>
                          )}
                        </Label>
                        <Input
                          id={id}
                          type={schema.type === "number" ? "number" : "text"}
                          value={formValues[key] ?? ""}
                          onChange={(e) =>
                            setFormValues((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                        />
                        {schema.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{schema.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Esta ferramenta não exige parâmetros — usa o telefone e o estado da conversa.
                </p>
              )}

              <Button onClick={() => void handleExecute()} disabled={running}>
                <Play className="mr-2 h-4 w-4" />
                {running ? "Executando…" : "Executar ferramenta"}
              </Button>
            </CardContent>
          </Card>

          {lastResult && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">Resultado</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {lastResult.durationMs}ms
                    {lastResult.handoff && <Badge variant="warning">Handoff humano</Badge>}
                  </div>
                </div>
                <CardDescription>
                  Conversa: <code className="text-xs">{lastResult.conversationId}</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">result (JSON)</p>
                  <pre className="max-h-80 overflow-auto rounded-lg bg-muted/50 p-3 text-xs">
                    {formatJson(lastResult.result)}
                  </pre>
                </div>
                {lastResult.statePatch && Object.keys(lastResult.statePatch).length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">statePatch</p>
                    <pre className="max-h-40 overflow-auto rounded-lg bg-muted/50 p-3 text-xs">
                      {formatJson(lastResult.statePatch)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {history.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Histórico desta sessão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.slice(1).map((item, i) => (
                  <button
                    key={`${item.at}-${i}`}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={() => setLastResult(item)}
                  >
                    <span className="font-medium">{item.toolName}</span>
                    <span className="text-xs text-muted-foreground">{item.durationMs}ms</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Referência por categoria</CardTitle>
          <CardDescription>
            {ASSISTANT_TOOL_CATALOG_BY_CATEGORY.map((g) => g.tools.length).reduce((a, b) => a + b, 0)}{" "}
            ferramentas em {ASSISTANT_TOOL_CATALOG_BY_CATEGORY.length} categorias
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ASSISTANT_TOOL_CATALOG_BY_CATEGORY.map((group) => (
            <div key={group.category} className="rounded-lg border p-3">
              <p className="text-sm font-semibold">{group.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{group.tools.length} ferramentas</p>
              <ul className="mt-2 space-y-1 text-xs">
                {group.tools.map((t) => (
                  <li key={t.name}>
                    <button
                      type="button"
                      className="text-left text-primary hover:underline"
                      onClick={() => selectTool(t.name)}
                    >
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
