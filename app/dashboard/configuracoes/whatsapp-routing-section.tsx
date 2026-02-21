"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

type RoutingStrategy = "general_secretary" | "first_responder" | "chatbot" | "round_robin";

interface WhatsAppRoutingSectionProps {
  clinicId: string;
}

export function WhatsAppRoutingSection({ clinicId }: WhatsAppRoutingSectionProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategy>("first_responder");
  const [generalSecretaryId, setGeneralSecretaryId] = useState<string>("");
  const [secretaries, setSecretaries] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/whatsapp/routing-settings").then((r) => r.json()),
      fetch("/api/whatsapp/secretaries").then((r) => r.json()),
    ]).then(([settings, secs]) => {
      setRoutingStrategy((settings.routing_strategy as RoutingStrategy) ?? "first_responder");
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
          Como as conversas de novos contatos são distribuídas entre as secretárias. Depois que um paciente já está vinculado a uma secretária (via consulta), as mensagens vão apenas para ela.
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
            <option value="general_secretary">Secretária geral</option>
            <option value="round_robin">Distribuir por carga (round-robin)</option>
            <option value="chatbot">Chatbot simples</option>
          </Select>
          <p className="text-xs text-muted-foreground">
            {routingStrategy === "first_responder" &&
              "Novas conversas ficam disponíveis para todas. A primeira secretária que responder assume a conversa."}
            {routingStrategy === "general_secretary" &&
              "Todas as novas conversas vão para a secretária geral, que coleta informações e encaminha para a equipe."}
            {routingStrategy === "round_robin" &&
              "Cada nova conversa é atribuída automaticamente à secretária com menos conversas abertas."}
            {routingStrategy === "chatbot" &&
              "Menu inicial (Agendar, Remarcar, Cancelar, Falar com atendente) direciona o fluxo."}
          </p>
        </div>

        {routingStrategy === "general_secretary" && (
          <div className="space-y-2">
            <Label htmlFor="general_secretary">Secretária geral</Label>
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
              <p className="text-xs text-amber-600">Cadastre secretárias em Equipe para usar esta opção.</p>
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
