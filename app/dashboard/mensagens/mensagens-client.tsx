"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  MessageEvent,
  ClinicMessageSetting,
  MessageTemplate,
  SendMode,
} from "./actions";
import { updateClinicMessageSetting } from "./actions";
import { Mail, MessageSquare, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

const CATEGORY_LABELS: Record<string, string> = {
  agendamento: "Agendamento",
  lembrete: "Lembretes",
  formulario: "Formulários",
  pos_consulta: "Pós-Consulta",
  outros: "Outros",
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

  // Busca direta no array (sem map intermediário)
  function getSetting(eventCode: string, channel: "email" | "whatsapp") {
    if (!Array.isArray(settings)) return undefined;
    return settings.find(
      (s) => s.event_code === eventCode && s.channel === channel
    );
  }

  const eventsByCategory = useMemo(() => {
    const map: Record<string, MessageEvent[]> = {};
    if (!Array.isArray(events)) return map;
    events.forEach((event) => {
      if (!map[event.category]) map[event.category] = [];
      map[event.category].push(event);
    });
    return map;
  }, [events]);

  async function handleToggle(
    eventCode: string,
    channel: "email" | "whatsapp",
    enabled: boolean
  ) {
    const key = `${eventCode}-${channel}`;
    setUpdating((prev) => ({ ...prev, [key]: true }));

    const currentSetting = getSetting(eventCode, channel);
    const sendMode = currentSetting?.send_mode ?? "manual";

    try {
      const result = await updateClinicMessageSetting(
        eventCode,
        channel,
        enabled,
        sendMode,
        currentSetting?.template_id ?? null
      );

      if (result.error) {
        alert(`Erro: ${result.error}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setUpdating((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function handleSendModeChange(
    eventCode: string,
    channel: "email" | "whatsapp",
    sendMode: SendMode
  ) {
    const key = `${eventCode}-${channel}-mode`;
    setUpdating((prev) => ({ ...prev, [key]: true }));

    const currentSetting = getSetting(eventCode, channel);
    const enabled = currentSetting?.enabled ?? false;

    try {
      const result = await updateClinicMessageSetting(
        eventCode,
        channel,
        enabled,
        sendMode,
        currentSetting?.template_id ?? null
      );

      if (result.error) {
        alert(`Erro: ${result.error}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setUpdating((prev) => ({ ...prev, [key]: false }));
    }
  }

  function getTemplatesForEvent(
    eventCode: string,
    channel: "email" | "whatsapp"
  ) {
    return templates.filter(
      (t) =>
        t.event_code === eventCode &&
        t.channel === channel &&
        t.is_active
    );
  }

  if (!events?.length) {
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
        {Object.entries(eventsByCategory).map(([category, categoryEvents]) => (
          <div key={category}>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <div className="space-y-3">
              {(categoryEvents ?? []).map((event) => {
                if (!event?.code) return null;
                const setting = getSetting(event.code, activeTab);
                const enabled = setting?.enabled ?? false;
                const sendMode = setting?.send_mode ?? "manual";
                const canBeAutomatic = event.can_be_automatic ?? false;
                const key = `${event.code}-${activeTab}`;
                const isLoading =
                  updating[key] === true || updating[`${key}-mode`] === true;

                return (
                  <Card key={event.code} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground">
                            {event.name}
                          </h3>
                          {event.description && (
                            <span className="text-xs text-muted-foreground">
                              ({event.description})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-3">
                          <Switch
                            id={`msg-${event.code}-${activeTab}-enabled`}
                            name={`msg_${event.code}_${activeTab}_enabled`}
                            checked={enabled}
                            onChange={(checked) =>
                              handleToggle(event.code, activeTab, checked)
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
                                id={`msg-${event.code}-${activeTab}-mode`}
                                name={`msg_${event.code}_${activeTab}_mode`}
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
                              <span className="text-sm text-muted-foreground">
                                Template:
                              </span>
                              <select
                                id={`msg-${event.code}-${activeTab}-template`}
                                name={`msg_${event.code}_${activeTab}_template`}
                                value={setting?.template_id ?? ""}
                                onChange={async (e) => {
                                  const templateId =
                                    e.target.value || null;
                                  const updateKey = `${event.code}-${activeTab}-template`;
                                  setUpdating((prev) => ({
                                    ...prev,
                                    [updateKey]: true,
                                  }));
                                  try {
                                    const result =
                                      await updateClinicMessageSetting(
                                        event.code,
                                        activeTab,
                                        enabled,
                                        sendMode,
                                        templateId
                                      );
                                    if (result.error) {
                                      alert(`Erro: ${result.error}`);
                                    } else {
                                      router.refresh();
                                    }
                                  } catch (err) {
                                    alert(
                                      err instanceof Error
                                        ? err.message
                                        : "Erro ao atualizar"
                                    );
                                  } finally {
                                    setUpdating((prev) => ({
                                      ...prev,
                                      [updateKey]: false,
                                    }));
                                  }
                                }}
                                disabled={isLoading}
                                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                              >
                                <option value="">Padrão</option>
                                {getTemplatesForEvent(
                                  event.code,
                                  activeTab
                                ).map((t) => (
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
