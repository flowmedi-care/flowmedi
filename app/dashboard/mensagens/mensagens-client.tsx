"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MessageEvent,
  ClinicMessageSetting,
  MessageTemplate,
  getMessageEvents,
  getClinicMessageSettings,
  getMessageTemplates,
  getRecentMessageLog,
  type MessageLogEntry,
} from "./actions";
import { EventosConfigModal } from "./eventos-config-modal";
import { Mail, MessageSquare, Plus, Settings2, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

export function MensagensClient() {
  const router = useRouter();
  const [events, setEvents] = useState<MessageEvent[]>([]);
  const [settings, setSettings] = useState<ClinicMessageSetting[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [recentLog, setRecentLog] = useState<MessageLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventosModalOpen, setEventosModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [eventsRes, settingsRes, templatesRes, logRes] = await Promise.all([
        getMessageEvents(),
        getClinicMessageSettings(),
        getMessageTemplates(),
        getRecentMessageLog(12),
      ]);
      setEvents(eventsRes.data ?? []);
      setSettings(settingsRes.data ?? []);
      setTemplates(templatesRes.data ?? []);
      setRecentLog(logRes.data ?? []);
      const err =
        eventsRes.error ??
        settingsRes.error ??
        templatesRes.error ??
        logRes.error;
      if (err) setLoadError(err);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Erro ao carregar"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSettingsChange = useCallback((next: ClinicMessageSetting[]) => {
    setSettings(next);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-destructive">{loadError}</p>
        <Button variant="outline" onClick={loadData}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Mensagens
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico, eventos e templates de email e WhatsApp
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/mensagens/pendentes")}
          >
            Mensagens Pendentes
          </Button>
          <Button onClick={() => router.push("/dashboard/mensagens/templates")}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Template
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {/* Mini dashboard: histórico recente */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Histórico de mensagens enviadas
            </h2>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {recentLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma mensagem enviada ainda.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentLog.map((entry) => (
                  <li
                    key={entry.id}
                    className="text-sm flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0"
                  >
                    <span className="truncate">
                      {entry.patient_name ?? "Paciente"} ·{" "}
                      {CHANNEL_LABELS[entry.channel] ?? entry.channel}
                    </span>
                    <span className="text-muted-foreground text-xs shrink-0">
                      {formatDate(entry.sent_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Configurar eventos (abre modal) */}
        <Card className="p-5">
          <div className="flex flex-col h-full">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-2">
              <Settings2 className="h-5 w-5" />
              Eventos de mensagem
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Defina quais eventos disparam email ou WhatsApp (lembretes,
              confirmações, formulários, etc.).
            </p>
            <Button
              variant="default"
              onClick={() => setEventosModalOpen(true)}
              className="mt-auto w-fit"
            >
              Configurar eventos (Email e WhatsApp)
            </Button>
          </div>
        </Card>
      </div>

      {/* Templates salvos */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Templates salvos
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/mensagens/templates")}
          >
            Ver todos
          </Button>
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-4">
            Nenhum template criado. Crie um para usar nos eventos.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {templates.slice(0, 6).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/dashboard/mensagens/templates/${t.id}/editar`
                    )
                  }
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium text-sm text-foreground block">
                    {t.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {CHANNEL_LABELS[t.channel]} · {t.event_code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboard/mensagens/templates/novo")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Criar template
        </Button>
      </Card>

      <EventosConfigModal
        open={eventosModalOpen}
        onOpenChange={setEventosModalOpen}
        events={events}
        settings={settings}
        templates={templates}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
}
