"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { MessageEvent, ClinicMessageSetting, MessageTemplate, SendMode } from "./actions";
import { updateClinicMessageSetting } from "./actions";
import { Settings, Mail, MessageSquare, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

type EventSettingsMap = Record<
  string,
  { email?: ClinicMessageSetting; whatsapp?: ClinicMessageSetting }
>;

const CATEGORY_LABELS: Record<string, string> = {
  agendamento: "Agendamento",
  lembrete: "Lembretes",
  formulario: "Formulários",
  pos_consulta: "Pós-Consulta",
  outros: "Outros",
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

export function MensagensClient({
  events,
  settings,
  templates,
}: {
  events: MessageEvent[];
  settings: ClinicMessageSetting[];
  templates: MessageTemplate[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"email" | "whatsapp">("email");
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  // Organizar configurações por evento
  const eventSettingsMap: EventSettingsMap = {};
  events.forEach((event) => {
    eventSettingsMap[event.code] = {};
  });

  settings.forEach((setting) => {
    if (!eventSettingsMap[setting.event_code]) {
      eventSettingsMap[setting.event_code] = {};
    }
    if (setting.channel === "email") {
      eventSettingsMap[setting.event_code].email = setting;
    } else {
      eventSettingsMap[setting.event_code].whatsapp = setting;
    }
  });

  // Agrupar eventos por categoria
  const eventsByCategory: Record<string, MessageEvent[]> = {};
  events.forEach((event) => {
    if (!eventsByCategory[event.category]) {
      eventsByCategory[event.category] = [];
    }
    eventsByCategory[event.category].push(event);
  });

  async function handleToggle(
    eventCode: string,
    channel: "email" | "whatsapp",
    enabled: boolean
  ) {
    const key = `${eventCode}-${channel}`;
    setUpdating({ ...updating, [key]: true });

    const currentSetting = eventSettingsMap[eventCode]?.[channel];
    const sendMode = currentSetting?.send_mode || "manual";

    const result = await updateClinicMessageSetting(
      eventCode,
      channel,
      enabled,
      sendMode,
      currentSetting?.template_id || null
    );

    setUpdating({ ...updating, [key]: false });

    if (result.error) {
      alert(`Erro: ${result.error}`);
    } else {
      router.refresh();
    }
  }

  async function handleSendModeChange(
    eventCode: string,
    channel: "email" | "whatsapp",
    sendMode: SendMode
  ) {
    const key = `${eventCode}-${channel}-mode`;
    setUpdating({ ...updating, [key]: true });

    const currentSetting = eventSettingsMap[eventCode]?.[channel];
    const enabled = currentSetting?.enabled || false;

    const result = await updateClinicMessageSetting(
      eventCode,
      channel,
      enabled,
      sendMode,
      currentSetting?.template_id || null
    );

    setUpdating({ ...updating, [key]: false });

    if (result.error) {
      alert(`Erro: ${result.error}`);
    } else {
      router.refresh();
    }
  }

  function getSetting(eventCode: string, channel: "email" | "whatsapp") {
    return eventSettingsMap[eventCode]?.[channel];
  }

  function getTemplatesForEvent(eventCode: string, channel: "email" | "whatsapp") {
    return templates.filter(
      (t) => t.event_code === eventCode && t.channel === channel && t.is_active
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Mensagens Automáticas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure eventos de email e WhatsApp para comunicação com pacientes
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/mensagens/templates")}>
          <Plus className="h-4 w-4 mr-2" />
          Criar Template
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
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

      {/* Lista de eventos por categoria */}
      <div className="space-y-6">
        {Object.entries(eventsByCategory).map(([category, categoryEvents]) => (
          <div key={category}>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {CATEGORY_LABELS[category] || category}
            </h2>
            <div className="space-y-3">
              {categoryEvents.map((event) => {
                const setting = getSetting(event.code, activeTab);
                const enabled = setting?.enabled || false;
                const sendMode = setting?.send_mode || "manual";
                const canBeAutomatic = event.can_be_automatic;
                const key = `${event.code}-${activeTab}`;
                const isLoading = updating[key] || updating[`${key}-mode`];

                return (
                  <Card key={event.code} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground">{event.name}</h3>
                          {event.description && (
                            <span className="text-xs text-muted-foreground">
                              ({event.description})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-3">
                          <Switch
                            checked={enabled}
                            onChange={(checked) =>
                              handleToggle(event.code, activeTab, checked)
                            }
                            disabled={isLoading}
                            label="Ativado"
                          />
                          {enabled && canBeAutomatic && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Envio:</span>
                              <select
                                value={sendMode}
                                onChange={(e) =>
                                  handleSendModeChange(
                                    event.code,
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
                              <span className="text-sm text-muted-foreground">Template:</span>
                              <select
                                value={setting?.template_id || ""}
                                onChange={async (e) => {
                                  const templateId = e.target.value || null;
                                  await updateClinicMessageSetting(
                                    event.code,
                                    activeTab,
                                    enabled,
                                    sendMode,
                                    templateId
                                  );
                                  router.refresh();
                                }}
                                disabled={isLoading}
                                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                              >
                                <option value="">Padrão</option>
                                {getTemplatesForEvent(event.code, activeTab).map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
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
          </div>
        ))}
      </div>
    </div>
  );
}
