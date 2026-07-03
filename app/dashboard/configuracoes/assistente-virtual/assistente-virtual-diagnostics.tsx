"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  ChevronDown,
  ClipboardList,
  Clock,
  Mic,
  MessageSquareWarning,
  RefreshCw,
  Server,
  Shield,
  Trash2,
  Zap,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import type { DataReadinessReport } from "@/lib/virtual-assistant/data-readiness";
import type {
  AiEventRow,
  AiToolLogRow,
  AssistantHealthCheck,
  BlockedConversationRow,
} from "@/lib/virtual-assistant/diagnostics";
import type { MessageFlowTrace } from "@/lib/virtual-assistant/diagnostics-flow";
import { AssistenteVirtualFlowTimeline } from "./assistente-virtual-flow-timeline";
import { cn } from "@/lib/utils";
import {
  ASSISTANT_TOOL_CATALOG,
  ASSISTANT_TOOL_CATALOG_BY_CATEGORY,
} from "@/lib/virtual-assistant/tools/catalog";
import {
  buildJourneyCoverageMatrix,
  COVERAGE_LABELS,
} from "@/lib/virtual-assistant/journey-coverage-matrix";
import { FlowmediAgentBento } from "@/components/agents/flowmedi-agent-bento";
import { AgentPipelineCanvas } from "@/components/agents/agent-pipeline-canvas";
import type { AgentPipelineStage } from "@/lib/virtual-assistant/agent-pipeline/stages";
import Link from "next/link";

interface DiagnosticsResponse {
  health: AssistantHealthCheck;
  events: AiEventRow[];
  flows: MessageFlowTrace[];
  dataReadiness?: DataReadinessReport;
  toolLogs: AiToolLogRow[];
  blockedConversations: BlockedConversationRow[];
}

interface Props {
  active: boolean;
}

function CollapsibleCard({
  title,
  description,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 p-6 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            {Icon && <Icon className="h-5 w-5 shrink-0" />}
            {title}
          </CardTitle>
          {description && (
            <CardDescription className={cn(!open && "line-clamp-2")}>{description}</CardDescription>
          )}
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <CardContent className="border-t pt-4">{children}</CardContent>}
    </Card>
  );
}

function ToolCategoryAccordion({
  label,
  tools,
}: {
  label: string;
  tools: (typeof ASSISTANT_TOOL_CATALOG)[number][];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted/50"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          {label}
          <span className="ml-2 font-normal text-muted-foreground">({tools.length})</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul className="max-h-72 space-y-2 overflow-y-auto border-t p-2">
          {tools.map((tool) => (
            <li key={tool.name} className="rounded-lg bg-muted/30 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{tool.label}</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {tool.name}
                </code>
              </div>
              <p className="mt-1 text-muted-foreground">{tool.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">Quando usar:</span> {tool.whenToUse}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HealthStat({
  icon: Icon,
  label,
  value,
  ok,
  warn,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  ok: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3",
        ok && "border-green-200/80 bg-green-50/50",
        !ok && warn && "border-amber-200/80 bg-amber-50/50",
        !ok && !warn && "border-red-200/80 bg-red-50/50"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          ok && "bg-green-100 text-green-700",
          !ok && warn && "bg-amber-100 text-amber-700",
          !ok && !warn && "bg-red-100 text-red-700"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

export function AssistenteVirtualDiagnostics({ active }: Props) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [simulatePhone, setSimulatePhone] = useState("");
  const [simulateText, setSimulateText] = useState("Oi, quero agendar uma consulta");
  const [showRawEvents, setShowRawEvents] = useState(false);

  const SIMULATE_SCENARIOS = [
    { label: "Quero agendar", text: "Oi, quero agendar uma consulta" },
    { label: "Quanto custa?", text: "Quanto custa a consulta?" },
    { label: "Quais convênios?", text: "Quais convênios vocês aceitam?" },
    { label: "Minha consulta", text: "Quando é minha consulta?" },
    { label: "O que vocês fazem?", text: "Quais procedimentos vocês fazem?" },
  ] as const;

  const livePipelineStage = useMemo((): AgentPipelineStage | null => {
    for (const ev of data?.events ?? []) {
      if (ev.stage !== "pipeline_stage_enter") continue;
      const detail = ev.detail as { to_stage?: string } | undefined;
      if (detail?.to_stage) return detail.to_stage as AgentPipelineStage;
    }
    return null;
  }, [data?.events]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/assistant/diagnostics");
      const json = (await res.json()) as DiagnosticsResponse & { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Erro ao carregar diagnóstico", "error");
        return;
      }
      setData(json);
    } catch {
      toast("Falha ao carregar diagnóstico", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    void load();
    const interval = setInterval(() => {
      void load();
    }, 10000);
    return () => clearInterval(interval);
  }, [active, load]);

  async function handleClearQueue() {
    const pending = data?.health.pendingInboundCount ?? 0;
    const audios = data?.health.pendingAudioCount ?? 0;
    const stuck = data?.health.stuckDebounceCount ?? 0;

    const summary =
      pending + audios + stuck > 0
        ? `${pending} mensagem(ns) pendente(s), ${audios} áudio(s) e ${stuck} debounce(s) preso(s).`
        : "Não há itens na fila no momento.";

    if (
      !confirm(
        `Zerar fila da IA?\n\n${summary}\n\nAs mensagens antigas serão descartadas SEM resposta. O contexto da IA nas conversas será reiniciado. Mensagens novas (após zerar) serão atendidas normalmente quando o assistente estiver ativo.\n\nEsta ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    setClearing(true);
    try {
      const res = await fetch("/api/whatsapp/assistant/clear-queue", { method: "POST" });
      const json = (await res.json()) as DiagnosticsResponse & {
        error?: string;
        messagesSkipped?: number;
        transcriptionJobsCleared?: number;
      };
      if (!res.ok) {
        toast(json.error ?? "Erro ao zerar fila", "error");
        return;
      }
      setData(json);
      toast(
        `Fila zerada: ${json.messagesSkipped ?? 0} mensagem(ns) descartada(s), ${json.transcriptionJobsCleared ?? 0} transcrição(ões) cancelada(s).`,
        "success"
      );
    } catch {
      toast("Falha ao zerar fila", "error");
    } finally {
      setClearing(false);
    }
  }

  async function handleProcessNow() {
    setProcessing(true);
    try {
      const res = await fetch("/api/whatsapp/assistant/process-now", { method: "POST" });
      const json = (await res.json()) as DiagnosticsResponse & {
        error?: string;
        processed?: number;
        total?: number;
      };
      if (!res.ok) {
        toast(json.error ?? "Erro ao processar fila", "error");
        return;
      }
      setData(json);
      toast(`Fila processada: ${json.processed ?? 0}/${json.total ?? 0} conversas`, "success");
    } catch {
      toast("Falha ao processar fila", "error");
    } finally {
      setProcessing(false);
    }
  }

  async function handleSimulate(immediate: boolean) {
    if (!simulatePhone.trim() || !simulateText.trim()) {
      toast("Informe telefone e mensagem", "error");
      return;
    }
    setSimulating(true);
    try {
      const res = await fetch("/api/whatsapp/assistant/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: simulatePhone.trim(),
          text: simulateText.trim(),
          processImmediately: immediate,
        }),
      });
      const json = (await res.json()) as DiagnosticsResponse & { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Erro na simulação", "error");
        return;
      }
      setData(json);
      setShowRawEvents(false);
      toast(
        immediate
          ? "Simulação processada. Veja o fluxo abaixo."
          : "Mensagem simulada agendada. Aguarde o debounce ou use Processar fila.",
        "success"
      );
    } catch {
      toast("Falha na simulação", "error");
    } finally {
      setSimulating(false);
    }
  }

  async function handleReactivate(conversationId: string) {
    setReactivatingId(conversationId);
    try {
      const res = await fetch("/api/whatsapp/assistant/reactivate-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const json = (await res.json()) as DiagnosticsResponse & { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Erro ao reativar IA", "error");
        return;
      }
      setData(json);
      toast("IA reativada nesta conversa.", "success");
    } catch {
      toast("Falha ao reativar IA", "error");
    } finally {
      setReactivatingId(null);
    }
  }

  const health = data?.health;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Agentes operacionais</p>
          <Button variant="link" size="sm" className="h-auto p-0" asChild>
            <Link href="/dashboard/crm/jornada/centro">Abrir Centro de Jornada</Link>
          </Button>
        </div>
        <FlowmediAgentBento compact pollMs={10000} />
      </div>

      <Card className="overflow-hidden border-0 shadow-md">
        <div className="border-b bg-gradient-to-r from-slate-50 to-slate-100/80 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                Status do assistente
              </CardTitle>
              <CardDescription className="mt-1">
                Atualiza a cada 10 segundos · acompanhe cada mensagem do recebimento ao envio
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
                disabled={loading}
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
                Atualizar
              </Button>
              <Button size="sm" onClick={() => void handleProcessNow()} disabled={processing || clearing}>
                <Zap className="mr-1.5 h-3.5 w-3.5" />
                {processing ? "Processando…" : "Processar fila"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => void handleClearQueue()}
                disabled={processing || clearing}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {clearing ? "Zerando…" : "Zerar fila"}
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="space-y-4 p-6">
          {loading && !data ? (
            <p className="text-sm text-muted-foreground">Carregando diagnóstico…</p>
          ) : health ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={health.assistantEnabled ? "success" : "destructive"}>
                  <Bot className="mr-1 h-3 w-3" />
                  {health.assistantEnabled ? "Assistente ativo" : "Assistente desativado"}
                </Badge>
                {health.pendingInboundCount > 0 && (
                  <Badge variant="warning">
                    {health.pendingInboundCount} na fila
                  </Badge>
                )}
                {health.pendingAudioCount > 0 && (
                  <Badge variant="outline" className="border-violet-300 text-violet-700">
                    <Mic className="mr-1 h-3 w-3" />
                    {health.pendingAudioCount} áudio(s)
                  </Badge>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <HealthStat
                  icon={MessageSquareWarning}
                  label="Mensagens pendentes"
                  value={health.pendingInboundCount}
                  ok={health.pendingInboundCount === 0}
                  warn={health.pendingInboundCount > 0}
                />
                <HealthStat
                  icon={Mic}
                  label="Áudios aguardando"
                  value={health.pendingAudioCount}
                  ok={health.pendingAudioCount === 0}
                  warn={health.pendingAudioCount > 0}
                />
                <HealthStat
                  icon={Clock}
                  label="Debounce preso"
                  value={health.stuckDebounceCount}
                  ok={health.stuckDebounceCount === 0}
                  warn={health.stuckDebounceCount > 0}
                />
                <HealthStat
                  icon={Shield}
                  label="Conversas bloqueadas"
                  value={health.blockedConversationCount}
                  ok={health.blockedConversationCount === 0}
                  warn={health.blockedConversationCount > 0}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <HealthStat
                  icon={Server}
                  label="OpenAI"
                  value={health.openaiConfigured ? "Configurada" : "Ausente"}
                  ok={health.openaiConfigured}
                />
                <HealthStat
                  icon={Mic}
                  label="Transcrição"
                  value={health.transcribeConfigured ? "Configurada" : "Ausente"}
                  ok={health.transcribeConfigured}
                />
                <HealthStat
                  icon={Zap}
                  label="Cron VPS"
                  value={health.cronSecretConfigured ? "Configurado" : "Opcional"}
                  ok={health.cronSecretConfigured}
                  warn={!health.cronSecretConfigured}
                />
              </div>

              {!health.migrationOk && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {health.migrationError ?? "Erro de migration no banco"}
                </p>
              )}
            </>
          ) : null}

          {health?.lastEventAt && (
            <p className="text-xs text-muted-foreground">
              Último evento em {new Date(health.lastEventAt).toLocaleString("pt-BR")}
            </p>
          )}
        </CardContent>
      </Card>

      {data?.dataReadiness && (
        <Card
          className={cn(
            data.dataReadiness.issues.length === 0
              ? "border-green-200"
              : "border-amber-200"
          )}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Dados para o bot
            </CardTitle>
            <CardDescription>
              Cadastros que o assistente usa no prompt e nas ferramentas. Corrija alertas para
              respostas mais precisas no WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <HealthStat
                icon={Bot}
                label="Procedimentos"
                value={data.dataReadiness.stats.procedures}
                ok={data.dataReadiness.stats.procedures > 0}
              />
              <HealthStat
                icon={Bot}
                label="Sem serviço de preço"
                value={data.dataReadiness.stats.proceduresWithoutService}
                ok={data.dataReadiness.stats.proceduresWithoutService === 0}
                warn
              />
              <HealthStat
                icon={Bot}
                label="Serviços sem preço"
                value={data.dataReadiness.stats.servicesWithoutPrice}
                ok={data.dataReadiness.stats.servicesWithoutPrice === 0}
                warn
              />
              <HealthStat
                icon={Bot}
                label="Vínculos médico ↔ proc."
                value={data.dataReadiness.stats.doctorProcedureLinks}
                ok={data.dataReadiness.stats.doctorProcedureLinks > 0}
                warn
              />
            </div>

            {data.dataReadiness.issues.length === 0 ? (
              <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                Cadastro completo para o assistente responder sobre procedimentos, preços e
                agendamentos.
              </p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto pr-1 text-sm">
                {data.dataReadiness.issues.map((issue, i) => (
                  <li
                    key={i}
                    className={cn(
                      "rounded-lg border px-3 py-2",
                      issue.level === "error"
                        ? "border-red-200 bg-red-50 text-red-800"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                    )}
                  >
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Simular mensagem</CardTitle>
          <CardDescription>
            Testa o pipeline sem o celular. O fluxo aparece na timeline abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Telefone (com DDD)</Label>
              <Input
                placeholder="62999999999"
                value={simulatePhone}
                onChange={(e) => setSimulatePhone(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Mensagem</Label>
              <Input value={simulateText} onChange={(e) => setSimulateText(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="w-full text-xs text-muted-foreground">Cenários rápidos:</span>
            {SIMULATE_SCENARIOS.map((s) => (
              <Button
                key={s.label}
                type="button"
                variant="secondary"
                size="sm"
                disabled={simulating}
                onClick={() => setSimulateText(s.text)}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={simulating}
              onClick={() => void handleSimulate(false)}
            >
              Simular com debounce
            </Button>
            <Button size="sm" disabled={simulating} onClick={() => void handleSimulate(true)}>
              Simular e processar agora
            </Button>
          </div>
        </CardContent>
      </Card>

      {livePipelineStage && (
        <Card>
          <CardHeader>
            <CardTitle>Pipeline em tempo real</CardTitle>
            <CardDescription>
              Última etapa registrada nos eventos recentes. Mapa completo em{" "}
              <Link
                href="/dashboard/configuracoes/assistente-virtual"
                className="text-primary hover:underline"
              >
                Configurações → Pipeline
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AgentPipelineCanvas currentStage={livePipelineStage} className="h-[480px]" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Passo a passo das mensagens</CardTitle>
          <CardDescription>
            Clique em um fluxo para ver os passos. Mensagens com badge <strong>Descartado</strong>{" "}
            não receberão resposta da IA — use <em>Zerar fila</em> antes de ativar o assistente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssistenteVirtualFlowTimeline
            flows={data?.flows ?? []}
            events={data?.events ?? []}
            showRaw={showRawEvents}
            onToggleRaw={setShowRawEvents}
          />
        </CardContent>
      </Card>

      {data?.blockedConversations && data.blockedConversations.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle>Conversas sem IA ativa</CardTitle>
            <CardDescription>
              Handoff humano, opt-out permanente do paciente ou IA pausada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
              {data.blockedConversations.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <span>
                    <strong>{c.phone_number}</strong>
                    {c.ai_user_opt_out && (
                      <span className="ml-2 text-red-700">opt-out permanente (DESATIVE)</span>
                    )}
                    {c.ai_handoff_at && !c.ai_user_opt_out && (
                      <span className="ml-2 text-amber-700">handoff humano</span>
                    )}
                    {c.ai_enabled === false && !c.ai_user_opt_out && !c.ai_handoff_at && (
                      <span className="ml-2 text-amber-700">IA pausada</span>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reactivatingId === c.id}
                    onClick={() => void handleReactivate(c.id)}
                  >
                    {reactivatingId === c.id ? "Reativando…" : "Reativar IA"}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data?.toolLogs && data.toolLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uso recente das ferramentas</CardTitle>
            <CardDescription>Últimas chamadas registradas nas conversas (24h).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="max-h-56 space-y-1 overflow-y-auto pr-1 text-sm">
              {data.toolLogs.map((t) => (
                <li key={t.id} className="flex justify-between gap-2 border-b py-2 last:border-0">
                  <span className="min-w-0 truncate">
                    {t.success ? "✓" : "✗"} {t.tool_name}
                    {t.result_summary ? ` — ${t.result_summary}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <CollapsibleCard
        title="Ferramentas da IA"
        description={`${ASSISTANT_TOOL_CATALOG.length} funções que o assistente pode chamar no WhatsApp. Expanda cada categoria para ver detalhes.`}
        icon={Wrench}
      >
        <div className="space-y-2">
          {ASSISTANT_TOOL_CATALOG_BY_CATEGORY.map((group) => (
            <ToolCategoryAccordion
              key={group.category}
              label={group.label}
              tools={group.tools}
            />
          ))}
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Cobertura da jornada do cliente"
        description="Mapa de quais etapas a IA cobre, quais são automáticas por evento e o que permanece humano."
      >
        <div className="max-h-80 overflow-y-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="p-2 text-left">Etapa</th>
                <th className="p-2 text-left">Cobertura</th>
                <th className="hidden p-2 text-left sm:table-cell">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {buildJourneyCoverageMatrix().map((row) => (
                <tr key={row.step} className="border-t">
                  <td className="p-2 font-medium">{row.label}</td>
                  <td className="p-2">{COVERAGE_LABELS[row.coverage]}</td>
                  <td className="hidden p-2 text-muted-foreground sm:table-cell">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Fora do escopo da IA: register_payment, marcar comanda paga, aceitar comprovante do paciente
          como prova de pagamento.
        </p>
      </CollapsibleCard>
    </div>
  );
}
