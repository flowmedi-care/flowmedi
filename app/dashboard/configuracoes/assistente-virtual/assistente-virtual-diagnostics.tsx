"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import type {
  AiEventRow,
  AiToolLogRow,
  AssistantHealthCheck,
} from "@/lib/virtual-assistant/diagnostics";

const STAGE_LABELS: Record<string, string> = {
  webhook_inbound: "Mensagem recebida (webhook)",
  routing_decision: "Decisão de roteamento",
  legacy_menu_no_reply: "Menu legado sem resposta",
  debounce_scheduled: "IA agendada (debounce)",
  processing_start: "Processamento iniciado",
  pending_messages: "Mensagens pendentes",
  openai_start: "Chamada OpenAI",
  openai_end: "Resposta OpenAI",
  reply_sent: "Resposta enviada",
  handoff: "Transferido para humano",
  cron_conversation_processed: "Processado pelo cron",
  simulate_inbound: "Simulação inbound",
  error: "Erro",
};

function statusClass(ok: boolean, warn = false): string {
  if (ok) return "border-green-200 bg-green-50 text-green-900";
  if (warn) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-red-200 bg-red-50 text-red-900";
}

function levelDot(level: string): string {
  if (level === "error") return "bg-red-500";
  if (level === "warn") return "bg-amber-500";
  return "bg-green-500";
}

interface DiagnosticsResponse {
  health: AssistantHealthCheck;
  events: AiEventRow[];
  toolLogs: AiToolLogRow[];
}

interface Props {
  active: boolean;
}

export function AssistenteVirtualDiagnostics({ active }: Props) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [simulatePhone, setSimulatePhone] = useState("");
  const [simulateText, setSimulateText] = useState("Oi, quero agendar uma consulta");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      toast(
        immediate
          ? "Simulação processada. Veja a timeline abaixo."
          : "Mensagem simulada agendada. Aguarde o debounce ou use Processar fila.",
        "success"
      );
    } catch {
      toast("Falha na simulação", "error");
    } finally {
      setSimulating(false);
    }
  }

  const health = data?.health;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Status do assistente</CardTitle>
          <CardDescription>
            Atualiza automaticamente a cada 10 segundos enquanto esta aba estiver aberta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load(); }} disabled={loading}>
              Atualizar
            </Button>
            <Button size="sm" onClick={() => void handleProcessNow()} disabled={processing}>
              {processing ? "Processando…" : "Processar fila agora"}
            </Button>
          </div>

          {loading && !data ? (
            <p className="text-sm text-muted-foreground">Carregando diagnóstico…</p>
          ) : health ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className={`rounded-md border p-3 text-sm ${statusClass(health.assistantEnabled)}`}>
                <strong>Assistente ativo:</strong> {health.assistantEnabled ? "Sim" : "Não — ative na aba Geral"}
              </div>
              <div className={`rounded-md border p-3 text-sm ${statusClass(health.migrationOk)}`}>
                <strong>Migration / banco:</strong>{" "}
                {health.migrationOk ? "OK" : health.migrationError ?? "Erro"}
              </div>
              <div className={`rounded-md border p-3 text-sm ${statusClass(health.openaiConfigured)}`}>
                <strong>OpenAI (servidor):</strong>{" "}
                {health.openaiConfigured ? "Configurada" : "OPENAI_API_KEY ausente na Vercel"}
              </div>
              <div
                className={`rounded-md border p-3 text-sm ${statusClass(health.cronSecretConfigured, !health.cronSecretConfigured)}`}
              >
                <strong>Cron VPS (fallback):</strong>{" "}
                {health.cronSecretConfigured ? "CRON_SECRET configurado" : "Opcional — waitUntil é o caminho principal"}
              </div>
              <div
                className={`rounded-md border p-3 text-sm ${statusClass(health.pendingInboundCount === 0, health.pendingInboundCount > 0)}`}
              >
                <strong>Mensagens pendentes IA:</strong> {health.pendingInboundCount}
              </div>
              <div
                className={`rounded-md border p-3 text-sm ${statusClass(health.stuckDebounceCount === 0, health.stuckDebounceCount > 0)}`}
              >
                <strong>Fila debounce presa:</strong> {health.stuckDebounceCount}
              </div>
            </div>
          ) : null}

          {health?.lastEventAt && (
            <p className="text-xs text-muted-foreground">
              Último evento: {STAGE_LABELS[health.lastEventStage ?? ""] ?? health.lastEventStage} em{" "}
              {new Date(health.lastEventAt).toLocaleString("pt-BR")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simular mensagem</CardTitle>
          <CardDescription>
            Testa o pipeline sem depender do celular. Use um número de teste ou de uma conversa existente.
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

      <Card>
        <CardHeader>
          <CardTitle>Timeline de eventos</CardTitle>
          <CardDescription>Últimos 50 eventos do assistente para esta clínica.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.events?.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum evento ainda. Envie uma mensagem pelo WhatsApp ou use a simulação acima.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.events.map((ev) => (
                <li key={ev.id} className="rounded-md border p-2 text-sm">
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 text-left"
                    onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${levelDot(ev.level)}`} />
                    <span className="flex-1">
                      <span className="font-medium">
                        {STAGE_LABELS[ev.stage] ?? ev.stage}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {new Date(ev.created_at).toLocaleString("pt-BR")}
                      </span>
                      {ev.conversation_id && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          conv: {ev.conversation_id.slice(0, 8)}…
                        </span>
                      )}
                    </span>
                  </button>
                  {expandedId === ev.id && (
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(ev.detail, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {data?.toolLogs && data.toolLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ferramentas da IA</CardTitle>
            <CardDescription>Últimas chamadas de tools (agendar, buscar paciente, etc.).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {data.toolLogs.map((t) => (
                <li key={t.id} className="flex justify-between gap-2 border-b py-1">
                  <span>
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
    </div>
  );
}
