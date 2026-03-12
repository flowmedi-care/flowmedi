"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

type RoutingStrategy = "general_secretary" | "first_responder" | "chatbot" | "round_robin";
type ChatbotFallback = "first_responder" | "round_robin";

const STRATEGY_DESCRIPTIONS: Record<RoutingStrategy, string> = {
  first_responder:
    "Novas conversas ficam em um pool disponível para todas as Secretário(a)s. A primeira que responder assume a conversa. Ideal quando a equipe é pequena e todos podem atender qualquer contato.",
  general_secretary:
    "Todas as novas conversas vão direto para uma Secretário(a) designada (a Secretário(a) geral). Ela coleta informações e encaminha para a equipe conforme necessário. Ideal quando há uma pessoa central de triagem.",
  round_robin:
    "Cada nova conversa é atribuída automaticamente à Secretário(a) com menos conversas abertas. Distribui a carga de forma equilibrada. Ideal para equipes com várias Secretário(a)s.",
  chatbot:
    "O paciente recebe um menu inicial: 1) Agendar, 2) Remarcar, 3) Cancelar, 4) Falar com atendente. O fluxo direciona para o Secretário(a) certo conforme procedimento e vínculos (profissional↔procedimento, Secretário(a)↔profissional). Para casos sem Secretário(a) definida ou com múltiplas opções, use o roteamento de apoio abaixo.",
};

const FALLBACK_DESCRIPTIONS: Record<ChatbotFallback, string> = {
  first_responder:
    "As conversas vão para um pool: todas as Secretário(a)s elegíveis veem e a primeira que responder assume. Casos: opção 2/3 sem paciente vinculado, opção 4 (Falar com atendente), procedimento com 0 ou vários profissionais/Secretário(a)s.",
  round_robin:
    "As conversas são atribuídas à Secretário(a) com menos conversas abertas. Casos: opção 2/3 sem paciente vinculado, opção 4 (Falar com atendente), procedimento com 0 ou vários profissionais/Secretário(a)s.",
};

interface WhatsAppRoutingSectionProps {
  clinicId: string;
}

export function WhatsAppRoutingSection({ clinicId }: WhatsAppRoutingSectionProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategy>("first_responder");
  const [chatbotFallback, setChatbotFallback] = useState<ChatbotFallback>("first_responder");
  const [generalSecretaryId, setGeneralSecretaryId] = useState<string>("");
  const [secretaries, setSecretaries] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/whatsapp/routing-settings").then((r) => r.json()),
      fetch("/api/whatsapp/secretaries").then((r) => r.json()),
    ]).then(([settings, secs]) => {
      setRoutingStrategy((settings.routing_strategy as RoutingStrategy) ?? "first_responder");
      setChatbotFallback((settings.chatbot_fallback_strategy as ChatbotFallback) ?? "first_responder");
      setGeneralSecretaryId(settings.general_secretary_id ?? "");
      setSecretaries(Array.isArray(secs) ? secs : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp/routing-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_strategy: routingStrategy,
          general_secretary_id: routingStrategy === "general_secretary" ? generalSecretaryId || null : null,
          chatbot_fallback_strategy: routingStrategy === "chatbot" ? chatbotFallback : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao salvar", "error");
        return;
      }
      toast("Configurações salvas.", "success");
    } catch {
      toast("Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roteamento de conversas WhatsApp</CardTitle>
        <CardDescription>
          Como as conversas de novos contatos são distribuídas entre as Secretário(a)s. Depois que um paciente já está vinculado a uma Secretário(a) (via consulta), as mensagens vão apenas para ela.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Estratégia para primeiros contatos</Label>
          <Select
            value={routingStrategy}
            onChange={(e) => setRoutingStrategy(e.target.value as RoutingStrategy)}
            className="max-w-md"
          >
            <option value="first_responder">Primeira que responder assume</option>
            <option value="general_secretary">Secretário(a) geral</option>
            <option value="round_robin">Revezamento</option>
            <option value="chatbot">Chatbot simples</option>
          </Select>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm text-foreground whitespace-pre-line">
            {STRATEGY_DESCRIPTIONS[routingStrategy]}
          </p>
        </div>

        {routingStrategy === "chatbot" && (
          <div className="space-y-2">
            <Label>Roteamento de apoio (chatbot)</Label>
            <p className="text-xs text-muted-foreground">
              Usado quando não há Secretário(a) definida (opções 2, 3, 4) ou quando o procedimento tem vários profissionais/Secretário(a)s.
            </p>
            <Select
              value={chatbotFallback}
              onChange={(e) => setChatbotFallback(e.target.value as ChatbotFallback)}
              className="max-w-md"
            >
              <option value="first_responder">Primeira que pegar</option>
              <option value="round_robin">Revezamento</option>
            </Select>
            <div className="rounded-lg border border-border bg-muted/20 p-3 mt-2">
              <p className="text-xs text-muted-foreground whitespace-pre-line">
                {FALLBACK_DESCRIPTIONS[chatbotFallback]}
              </p>
            </div>
          </div>
        )}

        {routingStrategy === "general_secretary" && (
          <div className="space-y-2">
            <Label htmlFor="general_secretary">Secretário(a) geral</Label>
            <Select
              id="general_secretary"
              value={generalSecretaryId}
              onChange={(e) => setGeneralSecretaryId(e.target.value)}
              className="max-w-md"
            >
              <option value="">Selecione...</option>
              {secretaries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
            {secretaries.length === 0 && (
              <p className="text-xs text-amber-600">Cadastre Secretário(a)s em Equipe para usar esta opção.</p>
            )}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}

