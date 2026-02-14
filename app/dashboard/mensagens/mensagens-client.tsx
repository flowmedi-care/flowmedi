"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MessageEvent,
  ClinicMessageSetting,
  getMessageEvents,
  getClinicMessageSettings,
  getEffectiveTemplatesForDisplay,
  getRecentMessageLog,
  createMessageTemplateFromSystem,
  type MessageLogEntry,
  type EffectiveTemplateItem,
} from "./actions";
import { Mail, MessageSquare, Plus, FileText, Edit, Copy } from "lucide-react";
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
  const [effectiveTemplates, setEffectiveTemplates] = useState<EffectiveTemplateItem[]>([]);
  const [recentLog, setRecentLog] = useState<MessageLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingSystemId, setUsingSystemId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [eventsRes, settingsRes, templatesRes, logRes] = await Promise.all([
        getMessageEvents(),
        getClinicMessageSettings(),
        getEffectiveTemplatesForDisplay(),
        getRecentMessageLog(12),
      ]);
      setEvents(eventsRes.data ?? []);
      setSettings(settingsRes.data ?? []);
      setEffectiveTemplates(templatesRes.data ?? []);
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

      </div>

      {/* Templates salvos: um por evento + canal (Email e WhatsApp separados) */}
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
        <p className="text-sm text-muted-foreground mb-4">
          Um template por evento para <strong>Email</strong> e outro para <strong>WhatsApp</strong> — cada canal tem seu próprio texto.
        </p>
        {effectiveTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-4">
            Nenhum template disponível. Execute a migration dos templates do sistema ou crie um template manualmente.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {effectiveTemplates.slice(0, 12).map((t) => (
              <li key={`${t.event_code}:${t.channel}`}>
                <div className="p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-sm text-foreground block truncate">
                        {t.event_name}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        {t.channel === "email" ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                        {CHANNEL_LABELS[t.channel]}
                        {t.is_system && (
                          <span className="text-muted-foreground/80"> · Padrão</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {t.body_preview}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {t.is_system ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={usingSystemId === `${t.event_code}:${t.channel}`}
                        onClick={async () => {
                          setUsingSystemId(`${t.event_code}:${t.channel}`);
                          const res = await createMessageTemplateFromSystem(t.event_code, t.channel);
                          setUsingSystemId(null);
                          if (res.error) {
                            alert(res.error);
                            return;
                          }
                          if (res.data?.id) router.push(`/dashboard/mensagens/templates/${res.data.id}/editar`);
                          else loadData();
                        }}
                      >
                        {usingSystemId === `${t.event_code}:${t.channel}` ? "..." : <Copy className="h-3 w-3 mr-1" />}
                        Usar e editar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => router.push(`/dashboard/mensagens/templates/${t.id}/editar`)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {effectiveTemplates.length > 12 && (
          <p className="text-xs text-muted-foreground mt-2">
            Mostrando 12 de {effectiveTemplates.length}. <button type="button" className="underline" onClick={() => router.push("/dashboard/mensagens/templates")}>Ver todos</button>
          </p>
        )}
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboard/mensagens/templates/novo")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Criar template (personalizado)
        </Button>
      </Card>

    </div>
  );
}
