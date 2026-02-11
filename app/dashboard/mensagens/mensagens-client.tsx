"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  MessageEvent,
  ClinicMessageSetting,
  MessageTemplate,
  SendMode,
  getMessageEvents,
  getClinicMessageSettings,
  getMessageTemplates,
  updateClinicMessageSetting,
} from "./actions";
import { Mail, MessageSquare, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

type EventSettingsMap = Record<
  string,
  { email?: ClinicMessageSetting; whatsapp?: ClinicMessageSetting }
>;

const CATEGORY_ORDER: string[] = [
  "agendamento",
  "lembrete",
  "formulario",
  "pos_consulta",
  "outros",
];

const CATEGORY_LABELS: Record<string, string> = {
  agendamento: "Agendamento",
  lembrete: "Lembretes",
  formulario: "Formulários",
  pos_consulta: "Pós-Consulta",
  outros: "Outros",
};

function mergeSetting(
  list: ClinicMessageSetting[],
  updated: ClinicMessageSetting | null
): ClinicMessageSetting[] {
  if (!updated?.event_code || !updated?.channel) return list;
  const idx = list.findIndex(
    (s) => s.event_code === updated.event_code && s.channel === updated.channel
  );
  if (idx === -1) return [...list, updated];
  const next = [...list];
  next[idx] = updated;
  return next;
}

export function MensagensClient() {
  const router = useRouter();
  const [events, setEvents] = useState<MessageEvent[]>([]);
  const [settings, setSettings] = useState<ClinicMessageSetting[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"email" | "whatsapp">("email");
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [eventsRes, settingsRes, templatesRes] = await Promise.all([
        getMessageEvents(),
        getClinicMessageSettings(),
        getMessageTemplates(),
      ]);
      setEvents(eventsRes.data ?? []);
      setSettings(settingsRes.data ?? []);
      setTemplates(templatesRes.data ?? []);
      const err = eventsRes.error ?? settingsRes.error ?? templatesRes.error;
      if (err) setLoadError(err);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Erro ao carregar configurações"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const eventSettingsMap: EventSettingsMap = useMemo(() => {
    const map: EventSettingsMap = {};
    events.forEach((event) => {
      if (event?.code) map[event.code] = {};
    });
    settings.forEach((setting) => {
      if (!setting?.event_code || !setting?.channel) return;
      if (!map[setting.event_code]) map[setting.event_code] = {};
      if (setting.channel === "email") {
        map[setting.event_code].email = setting;
      } else {
        map[setting.event_code].whatsapp = setting;
      }
    });
    return map;
  }, [events, settings]);

  const eventsByCategory = useMemo(() => {
    const map: Record<string, MessageEvent[]> = {};
    events.forEach((event) => {
      const cat = event?.category ?? "outros";
      if (!map[cat]) map[cat] = [];
      map[cat].push(event);
    });
    return map;
  }, [events]);

  const orderedCategories = useMemo((): string[] => {
    const keys = Object.keys(eventsByCategory);
    const known = new Set(CATEGORY_ORDER);
    return [
      ...CATEGORY_ORDER.filter((c) => keys.includes(c)),
      ...keys.filter((k) => !known.has(k)),
    ];
  }, [eventsByCategory]);

  const getSetting = useCallback(
    (eventCode: string, channel: "email" | "whatsapp") =>
      eventSettingsMap[eventCode]?.[channel],
    [eventSettingsMap]
  );

  const getTemplatesForEvent = useCallback(
    (eventCode: string, channel: "email" | "whatsapp") =>
      templates.filter(
        (t) =>
          t.event_code === eventCode &&
          t.channel === channel &&
          t.is_active
      ),
    [templates]
  );

  async function handleToggle(
    eventCode: string,
    channel: "email" | "whatsapp",
    enabled: boolean
  ) {
    const key = `${eventCode}-${channel}`;
    setUpdating((p) => ({ ...p, [key]: true }));
    const current = getSetting(eventCode, channel);
    const sendMode = current?.send_mode ?? "manual";
    try {
      const result = await updateClinicMessageSetting(
        eventCode,
        channel,
        enabled,
        sendMode,
        current?.template_id ?? null
      );
      if (result.error) {
        alert(`Erro: ${result.error}`);
      } else if (result.data) {
        setSettings((prev) => mergeSetting(prev, result.data));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setUpdating((p) => ({ ...p, [key]: false }));
    }
  }

  async function handleSendModeChange(
    eventCode: string,
    channel: "email" | "whatsapp",
    sendMode: SendMode
  ) {
    const key = `${eventCode}-${channel}-mode`;
    setUpdating((p) => ({ ...p, [key]: true }));
    const current = getSetting(eventCode, channel);
    const enabled = current?.enabled ?? false;
    try {
      const result = await updateClinicMessageSetting(
        eventCode,
        channel,
        enabled,
        sendMode,
        current?.template_id ?? null
      );
      if (result.error) {
        alert(`Erro: ${result.error}`);
      } else if (result.data) {
        setSettings((prev) => mergeSetting(prev, result.data));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setUpdating((p) => ({ ...p, [key]: false }));
    }
  }

  async function handleTemplateChange(
    eventCode: string,
    channel: "email" | "whatsapp",
    templateId: string | null
  ) {
    const current = getSetting(eventCode, channel);
    if (!current) return;
    const key = `${eventCode}-${channel}-template`;
    setUpdating((p) => ({ ...p, [key]: true }));
    try {
      const result = await updateClinicMessageSetting(
        eventCode,
        channel,
        current.enabled,
        current.send_mode,
        templateId
      );
      if (result.error) {
        alert(`Erro: ${result.error}`);
      } else if (result.data) {
        setSettings((prev) => mergeSetting(prev, result.data));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setUpdating((p) => ({ ...p, [key]: false }));
    }
  }

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

  if (!events.length) {
    return (
      <div className="space-y-6 p-6">
        <p className="text-muted-foreground">Nenhum evento disponível.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Mensagens Automáticas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure eventos de email e WhatsApp para comunicação com pacientes
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

      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setActiveTab("email")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "email"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mail className="h-4 w-4 inline mr-2" />
          Email
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("whatsapp")}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "whatsapp"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-4 w-4 inline mr-2" />
          WhatsApp
        </button>
      </div>

      <div className="space-y-6">
        {orderedCategories.map((category) => {
          const categoryEvents = eventsByCategory[category] ?? [];
          return (
            <section key={category}>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <div className="space-y-3">
                {categoryEvents.map((event) => {
                  const code = event?.code;
                  if (!code) return null;
                  const setting = getSetting(code, activeTab);
                  const enabled = setting?.enabled ?? false;
                  const sendMode = setting?.send_mode ?? "manual";
                  const canBeAutomatic = event.can_be_automatic ?? false;
                  const updatingKey = `${code}-${activeTab}`;
                  const isLoading =
                    updating[updatingKey] === true ||
                    updating[`${updatingKey}-mode`] === true ||
                    updating[`${updatingKey}-template`] === true;

                  return (
                    <Card key={`${category}-${code}`} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-foreground">
                              {event.name ?? code}
                            </h3>
                            {event.description != null &&
                              event.description !== "" && (
                                <span className="text-xs text-muted-foreground">
                                  ({event.description})
                                </span>
                              )}
                          </div>
                          <div className="flex items-center gap-4 mt-3 flex-wrap">
                            <Switch
                              checked={enabled}
                              onChange={(checked) =>
                                handleToggle(code, activeTab, checked)
                              }
                              disabled={isLoading}
                              label="Ativado"
                            />
                            {enabled && canBeAutomatic && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  Envio:
                                </span>
                                <select
                                  value={sendMode}
                                  onChange={(e) =>
                                    handleSendModeChange(
                                      code,
                                      activeTab,
                                      e.target.value as SendMode
                                    )
                                  }
                                  disabled={isLoading}
                                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                                >
                                  <option value="automatic">Automático</option>
                                  <option value="manual">Manual</option>
                                </select>
                              </div>
                            )}
                            {enabled && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  Template:
                                </span>
                                <select
                                  value={setting?.template_id ?? ""}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const templateId =
                                      raw && raw.trim() !== "" ? raw : null;
                                    handleTemplateChange(
                                      code,
                                      activeTab,
                                      templateId
                                    );
                                  }}
                                  disabled={isLoading}
                                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                                >
                                  <option value="">Padrão</option>
                                  {getTemplatesForEvent(code, activeTab).map(
                                    (t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name ?? t.id}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
