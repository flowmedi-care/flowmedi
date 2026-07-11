"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import type { VirtualAssistantFaq, VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import { saveVirtualAssistantSettings } from "./actions";
import { AssistenteVirtualDiagnostics } from "./assistente-virtual-diagnostics";
import { AssistenteVirtualFaqTab } from "./assistente-virtual-faq-tab";
import { AssistenteVirtualToolsPlayground } from "./assistente-virtual-tools-playground";
import { AssistenteVirtualPipelineTab } from "./assistente-virtual-pipeline-tab";
import { AssistenteVirtualFlowsTab } from "./assistente-virtual-flows-tab";
import type { ToolDefinition } from "@/lib/virtual-assistant/openai-client";
import type { ConversationFlowsConfig } from "@/lib/attendance-flow/types";
import { mergeConversationFlows } from "@/lib/attendance-flow/defaults";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { SegmentedTabs } from "@/components/dashboard-ui/layout/segmented-tabs";

type TabId = "geral" | "politicas" | "faq" | "comportamento" | "ferramentas" | "fluxos" | "pipeline" | "diagnostico";

interface Props {
  canUse: boolean;
  initialSettings: Partial<VirtualAssistantSettings> | null;
  initialFaq: VirtualAssistantFaq[];
  toolDefinitions: ToolDefinition[];
  initialConversationFlows?: ConversationFlowsConfig;
  clinic: {
    auto_message_send_start: string | null;
    auto_message_send_end: string | null;
  } | null;
}

export function AssistenteVirtualClient({
  canUse,
  initialSettings,
  initialFaq,
  toolDefinitions,
  initialConversationFlows,
  clinic,
}: Props) {
  const [tab, setTab] = useState<TabId>("geral");
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(initialSettings?.enabled ?? false);
  const [assistantName, setAssistantName] = useState(initialSettings?.assistant_name ?? "Assistente");
  const [tone, setTone] = useState<"formal" | "informal">(initialSettings?.tone ?? "informal");
  const [useEmojis, setUseEmojis] = useState(initialSettings?.use_emojis !== false);
  const [debounce, setDebounce] = useState(String(initialSettings?.message_debounce_seconds ?? 5));
  const [humanHandoff, setHumanHandoff] = useState(initialSettings?.human_handoff_enabled !== false);
  const [paymentMethods, setPaymentMethods] = useState(
    (initialSettings?.payment_methods ?? []).join(", ")
  );
  const [cancellationPolicy, setCancellationPolicy] = useState(
    initialSettings?.cancellation_policy ?? ""
  );
  const [avgWait, setAvgWait] = useState(initialSettings?.avg_wait_time ?? "");
  const [promotions, setPromotions] = useState(initialSettings?.active_promotions ?? "");
  const [botStart, setBotStart] = useState(
    String(initialSettings?.bot_active_start ?? clinic?.auto_message_send_start ?? "08:00:00").slice(0, 5)
  );
  const [botEnd, setBotEnd] = useState(
    String(initialSettings?.bot_active_end ?? clinic?.auto_message_send_end ?? "20:00:00").slice(0, 5)
  );
  const tabs: { id: TabId; label: string }[] = [
    { id: "geral", label: "Geral" },
    { id: "politicas", label: "Políticas" },
    { id: "faq", label: "FAQ" },
    { id: "comportamento", label: "Comportamento" },
    { id: "ferramentas", label: "Ferramentas" },
    { id: "fluxos", label: "Fluxos Conversacionais" },
    { id: "pipeline", label: "Pipeline" },
    { id: "diagnostico", label: "Diagnóstico" },
  ];

  async function handleEnabledToggle(next: boolean) {
    setEnabled(next);
    setSaving(true);
    const result = await saveVirtualAssistantSettings({ enabled: next });
    setSaving(false);
    if (result.error) {
      setEnabled(!next);
      toast(result.error, "error");
      return;
    }
    toast(next ? "Assistente ativado no WhatsApp." : "Assistente desativado.", "success");
  }

  async function handleSave(partial?: Parameters<typeof saveVirtualAssistantSettings>[0]) {
    setSaving(true);
    const debounceNum = Number.parseInt(debounce, 10);
    const result = await saveVirtualAssistantSettings({
      enabled,
      assistant_name: assistantName.trim() || "Assistente",
      tone,
      use_emojis: useEmojis,
      human_handoff_enabled: humanHandoff,
      message_debounce_seconds: Number.isFinite(debounceNum) ? debounceNum : 5,
      payment_methods: paymentMethods
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      cancellation_policy: cancellationPolicy.trim() || null,
      avg_wait_time: avgWait.trim() || null,
      active_promotions: promotions.trim() || null,
      bot_active_start: botStart,
      bot_active_end: botEnd,
      ...partial,
    });
    setSaving(false);
    if (result.error) {
      toast(result.error, "error");
    } else {
      toast("Configurações salvas.", "success");
    }
  }

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Assistente virtual" }],
        title: "Assistente virtual",
        description: "Configure o chatbot com IA para atender pacientes no WhatsApp.",
      }}
      tabs={
        <SegmentedTabs
          tabs={tabs}
          value={tab}
          onChange={(id) => setTab(id as TabId)}
          variant="underline"
        />
      }
    >
      {!canUse && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="pt-4 text-sm text-amber-900">
            O assistente virtual está disponível em planos com WhatsApp ativo.
          </CardContent>
        </Card>
      )}

      <Card className="mb-4 border-muted">
        <CardContent className="pt-4 text-sm text-muted-foreground">
          Dados da clínica (contato, localização, horários e informações institucionais) são
          gerenciados em{" "}
          <Link href="/dashboard/configuracoes/clinica" className="text-primary hover:underline">
            Dados da clínica
          </Link>
          .
        </CardContent>
      </Card>

      {tab === "geral" && (
        <Card>
          <CardHeader>
            <CardTitle>Ativação e personalidade</CardTitle>
            <CardDescription>
              Quando ativo, o assistente substitui o menu fixo do WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                disabled={!canUse || saving}
                onChange={(e) => void handleEnabledToggle(e.target.checked)}
              />
              Ativar assistente virtual no WhatsApp
            </label>
            {!canUse && (
              <p className="text-xs text-amber-700">
                Plano sem assistente virtual — o toggle fica desabilitado até upgrade.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nome do atendente virtual</Label>
                <Input value={assistantName} onChange={(e) => setAssistantName(e.target.value)} />
              </div>
              <div>
                <Label>Tom de voz</Label>
                <Select value={tone} onChange={(e) => setTone(e.target.value as "formal" | "informal")}>
                  <option value="informal">Casual</option>
                  <option value="formal">Formal</option>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useEmojis} onChange={(e) => setUseEmojis(e.target.checked)} />
              Usar emojis nas respostas
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={humanHandoff}
                onChange={(e) => setHumanHandoff(e.target.checked)}
              />
              Permitir transferência para atendente humano
            </label>
            <div>
              <Label>Aguardar antes de responder (segundos)</Label>
              <Input
                type="number"
                min={2}
                max={30}
                value={debounce}
                onChange={(e) => setDebounce(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Espera o paciente terminar de digitar mensagens em sequência.
              </p>
            </div>
            <Button onClick={() => handleSave()} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "politicas" && (
        <Card>
          <CardHeader>
            <CardTitle>Políticas operacionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Formas de pagamento (separadas por vírgula)</Label>
              <Input value={paymentMethods} onChange={(e) => setPaymentMethods(e.target.value)} />
            </div>
            <div>
              <Label>Cancelamento / reembolso</Label>
              <textarea
                className="w-full min-h-[60px] rounded-md border px-3 py-2 text-sm"
                value={cancellationPolicy}
                onChange={(e) => setCancellationPolicy(e.target.value)}
              />
            </div>
            <div>
              <Label>Tempo médio de espera</Label>
              <Input value={avgWait} onChange={(e) => setAvgWait(e.target.value)} />
            </div>
            <div>
              <Label>Promoções ativas</Label>
              <textarea
                className="w-full min-h-[60px] rounded-md border px-3 py-2 text-sm"
                value={promotions}
                onChange={(e) => setPromotions(e.target.value)}
              />
            </div>
            <Button onClick={() => handleSave()} disabled={saving}>
              Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "faq" && <AssistenteVirtualFaqTab initialFaq={initialFaq} />}

      {tab === "comportamento" && (
        <Card>
          <CardHeader>
            <CardTitle>Horário do bot</CardTitle>
            <CardDescription>
              Fora deste horário, o bot envia mensagem educada de indisponibilidade.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Início</Label>
                <Input type="time" value={botStart} onChange={(e) => setBotStart(e.target.value)} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="time" value={botEnd} onChange={(e) => setBotEnd(e.target.value)} />
              </div>
            </div>
            <Button onClick={() => handleSave()} disabled={saving}>
              Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "ferramentas" && (
        <AssistenteVirtualToolsPlayground toolDefinitions={toolDefinitions} />
      )}

      {tab === "fluxos" && (
        <AssistenteVirtualFlowsTab
          initialFlows={mergeConversationFlows(initialConversationFlows ?? null)}
        />
      )}

      {tab === "pipeline" && (
        <AssistenteVirtualPipelineTab
          initialToolModes={initialSettings?.tool_execution_modes ?? null}
        />
      )}

      {tab === "diagnostico" && <AssistenteVirtualDiagnostics active={tab === "diagnostico"} />}
    </PageShell>
  );
}
