"use client";

import { useState, useMemo, useEffect, useTransition, useRef } from "react";
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

// Função auxiliar para calcular hash dos settings
function getSettingsHash(s: ClinicMessageSetting[]): string {
  return JSON.stringify(s.map(s => ({ id: s.id, enabled: s.enabled, send_mode: s.send_mode, template_id: s.template_id })));
}

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
  const [localSettings, setLocalSettings] = useState<ClinicMessageSetting[]>(settings);
  const settingsRef = useRef(settings);
  const isUpdatingRef = useRef(false);
  const lastSettingsHashRef = useRef<string>("");

  // Atualizar ref quando settings mudarem
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Inicializar hash na primeira renderização
  useEffect(() => {
    if (lastSettingsHashRef.current === "") {
      lastSettingsHashRef.current = getSettingsHash(settings);
    }
  }, [settings]);

  // Sincronizar localSettings quando settings mudarem (após refresh)
  // Mas apenas se não estiver atualizando nada E se realmente mudou
  useEffect(() => {
    const currentHash = getSettingsHash(settings);
    const hasRealChange = currentHash !== lastSettingsHashRef.current;
    
    if (!isUpdatingRef.current && hasRealChange) {
      try {
        console.log("[useEffect] Sincronizando settings do servidor");
        lastSettingsHashRef.current = currentHash;
        setLocalSettings(settings);
      } catch (error) {
        console.error("Erro ao sincronizar settings:", error);
      }
    }
  }, [settings]);

  // Organizar configurações por evento (usar localSettings se disponível)
  const eventSettingsMap: EventSettingsMap = useMemo(() => {
    try {
      const map: EventSettingsMap = {};
      if (!events || !Array.isArray(events)) {
        console.warn("Events não é um array válido:", events);
        return map;
      }
      
      events.forEach((event) => {
        if (event?.code) {
          map[event.code] = {};
        }
      });

      if (!localSettings || !Array.isArray(localSettings)) {
        console.warn("LocalSettings não é um array válido:", localSettings);
        return map;
      }

      localSettings.forEach((setting) => {
        if (!setting?.event_code || !setting?.channel) {
          console.warn("Setting inválido:", setting);
          return;
        }
        if (!map[setting.event_code]) {
          map[setting.event_code] = {};
        }
        if (setting.channel === "email") {
          map[setting.event_code].email = setting;
        } else {
          map[setting.event_code].whatsapp = setting;
        }
      });

      return map;
    } catch (error) {
      console.error("Erro ao criar eventSettingsMap:", error);
      return {};
    }
  }, [events, localSettings]);

  // Agrupar eventos por categoria
  const eventsByCategory: Record<string, MessageEvent[]> = useMemo(() => {
    const map: Record<string, MessageEvent[]> = {};
    events.forEach((event) => {
      if (!map[event.category]) {
        map[event.category] = [];
      }
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
    
    try {
      console.log("[handleToggle] Iniciando:", { eventCode, channel, enabled });
      
      isUpdatingRef.current = true;
      setUpdating((prev) => ({ ...prev, [key]: true }));

      const currentSetting = eventSettingsMap[eventCode]?.[channel];
      const sendMode = currentSetting?.send_mode || "manual";

      // Atualizar estado local otimisticamente (apenas uma vez)
      setLocalSettings((prev) => {
        try {
          // Verificar se já está no estado desejado para evitar atualizações desnecessárias
          const existing = prev.find(
            (s) => s.event_code === eventCode && s.channel === channel
          );
          if (existing && existing.enabled === enabled) {
            console.log("[handleToggle] Estado já está correto, pulando atualização");
            return prev;
          }

          const updated = [...prev];
          const index = updated.findIndex(
            (s) => s.event_code === eventCode && s.channel === channel
          );

          if (index >= 0) {
            updated[index] = { ...updated[index], enabled };
          } else {
            // Criar nova configuração se não existir
            const clinicId = updated[0]?.clinic_id || settingsRef.current[0]?.clinic_id || "";
            updated.push({
              id: `temp-${Date.now()}`,
              clinic_id: clinicId,
              event_code: eventCode,
              channel,
              enabled,
              send_mode: sendMode,
              template_id: null,
              conditions: {},
            });
          }

          // Atualizar hash para evitar que useEffect sobrescreva
          lastSettingsHashRef.current = getSettingsHash(updated);
          console.log("[handleToggle] Estado local atualizado:", updated);
          return updated;
        } catch (error) {
          console.error("[handleToggle] Erro ao atualizar estado local:", error);
          return prev;
        }
      });

      const result = await updateClinicMessageSetting(
        eventCode,
        channel,
        enabled,
        sendMode,
        currentSetting?.template_id || null
      );

      console.log("[handleToggle] Resultado do servidor:", result);

      if (result.error) {
        // Reverter mudança local em caso de erro
        setLocalSettings((prev) => {
          try {
            const reverted = [...prev];
            const index = reverted.findIndex(
              (s) => s.event_code === eventCode && s.channel === channel
            );
            if (index >= 0) {
              const original = settingsRef.current.find(
                (s) => s.event_code === eventCode && s.channel === channel
              );
              if (original) {
                reverted[index] = original;
              } else {
                reverted.splice(index, 1);
              }
            }
            return reverted;
          } catch (error) {
            console.error("[handleToggle] Erro ao reverter:", error);
            return prev;
          }
        });
        alert(`Erro: ${result.error}`);
      } else {
        // Não fazer refresh imediato - confiar no estado local
        // O refresh acontecerá naturalmente quando necessário
        console.log("[handleToggle] Sucesso - mantendo estado local");
      }
    } catch (error) {
      console.error("[handleToggle] Erro geral:", error);
      // Reverter em caso de erro
      setLocalSettings((prev) => {
        try {
          const reverted = [...prev];
          const index = reverted.findIndex(
            (s) => s.event_code === eventCode && s.channel === channel
          );
          if (index >= 0) {
            const original = settingsRef.current.find(
              (s) => s.event_code === eventCode && s.channel === channel
            );
            if (original) {
              reverted[index] = original;
            } else {
              reverted.splice(index, 1);
            }
          }
          return reverted;
        } catch (revertError) {
          console.error("[handleToggle] Erro ao reverter:", revertError);
          return prev;
        }
      });
      alert(`Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    } finally {
      setUpdating((prev) => {
        const newState = { ...prev, [key]: false };
        // Verificar se ainda há atualizações pendentes
        const hasActiveUpdates = Object.values(newState).some((v) => v === true);
        if (!hasActiveUpdates) {
          isUpdatingRef.current = false;
        }
        return newState;
      });
    }
  }

  async function handleSendModeChange(
    eventCode: string,
    channel: "email" | "whatsapp",
    sendMode: SendMode
  ) {
    const key = `${eventCode}-${channel}-mode`;
    isUpdatingRef.current = true;
    setUpdating((prev) => ({ ...prev, [key]: true }));

    const currentSetting = eventSettingsMap[eventCode]?.[channel];
    const enabled = currentSetting?.enabled || false;

    // Atualizar estado local otimisticamente
    setLocalSettings((prev) => {
      const updated = [...prev];
      const index = updated.findIndex(
        (s) => s.event_code === eventCode && s.channel === channel
      );

      if (index >= 0) {
        updated[index] = { ...updated[index], send_mode: sendMode };
      }

      return updated;
    });

    try {
      const result = await updateClinicMessageSetting(
        eventCode,
        channel,
        enabled,
        sendMode,
        currentSetting?.template_id || null
      );

      if (result.error) {
        // Reverter mudança local em caso de erro
        setLocalSettings((prev) => {
          const reverted = [...prev];
          const index = reverted.findIndex(
            (s) => s.event_code === eventCode && s.channel === channel
          );
          if (index >= 0) {
            const original = settings.find(
              (s) => s.event_code === eventCode && s.channel === channel
            );
            if (original) {
              reverted[index] = original;
            }
          }
          return reverted;
        });
        alert(`Erro: ${result.error}`);
      } else {
        // Não fazer refresh imediato - confiar no estado local
        console.log("[handleSendModeChange] Sucesso - mantendo estado local");
      }
    } catch (error) {
      // Reverter em caso de erro
      setLocalSettings((prev) => {
        const reverted = [...prev];
        const index = reverted.findIndex(
          (s) => s.event_code === eventCode && s.channel === channel
        );
        if (index >= 0) {
          const original = settings.find(
            (s) => s.event_code === eventCode && s.channel === channel
          );
          if (original) {
            reverted[index] = original;
          }
        }
        return reverted;
      });
      alert(`Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    } finally {
      setUpdating((prev) => {
        const newState = { ...prev, [key]: false };
        // Verificar se ainda há atualizações pendentes
        const hasActiveUpdates = Object.values(newState).some((v) => v === true);
        if (!hasActiveUpdates) {
          isUpdatingRef.current = false;
        }
        return newState;
      });
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

  // Validar dados antes de renderizar
  if (!events || !Array.isArray(events)) {
    console.error("Events inválido:", events);
    return (
      <div className="space-y-6 p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Erro: Dados inválidos</h2>
          <p className="text-sm text-red-600">Events não é um array válido</p>
        </div>
      </div>
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
        {Object.entries(eventsByCategory || {}).map(([category, categoryEvents]) => {
          if (!categoryEvents || !Array.isArray(categoryEvents)) {
            console.warn("categoryEvents inválido para categoria:", category);
            return null;
          }
          return (
            <div key={category}>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                {CATEGORY_LABELS[category] || category}
              </h2>
              <div className="space-y-3">
                {categoryEvents.map((event) => {
                  if (!event || !event.code) {
                    console.warn("Event inválido:", event);
                    return null;
                  }
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
                                  const updateKey = `${event.code}-${activeTab}-template`;
                                  isUpdatingRef.current = true;
                                  setUpdating((prev) => ({ ...prev, [updateKey]: true }));

                                  // Atualizar estado local
                                  setLocalSettings((prev) => {
                                    const updated = [...prev];
                                    const index = updated.findIndex(
                                      (s) => s.event_code === event.code && s.channel === activeTab
                                    );

                                    if (index >= 0) {
                                      updated[index] = { ...updated[index], template_id: templateId };
                                    }

                                    return updated;
                                  });

                                  try {
                                    const result = await updateClinicMessageSetting(
                                      event.code,
                                      activeTab,
                                      enabled,
                                      sendMode,
                                      templateId
                                    );

                                    if (result.error) {
                                      setLocalSettings((prev) => {
                                        const reverted = [...prev];
                                        const index = reverted.findIndex(
                                          (s) => s.event_code === event.code && s.channel === activeTab
                                        );
                                        if (index >= 0) {
                                          const original = settings.find(
                                            (s) => s.event_code === event.code && s.channel === activeTab
                                          );
                                          if (original) {
                                            reverted[index] = original;
                                          }
                                        }
                                        return reverted;
                                      });
                                      alert(`Erro: ${result.error}`);
                                    } else {
                                      // Não fazer refresh imediato - confiar no estado local
                                      console.log("[Template Change] Sucesso - mantendo estado local");
                                    }
                                  } catch (error) {
                                    setLocalSettings((prev) => {
                                      const reverted = [...prev];
                                      const index = reverted.findIndex(
                                        (s) => s.event_code === event.code && s.channel === activeTab
                                      );
                                      if (index >= 0) {
                                        const original = settings.find(
                                          (s) => s.event_code === event.code && s.channel === activeTab
                                        );
                                        if (original) {
                                          reverted[index] = original;
                                        }
                                      }
                                      return reverted;
                                    });
                                    alert(`Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
                                  } finally {
                                    setUpdating((prev) => {
                                      const newState = { ...prev, [updateKey]: false };
                                      // Verificar se ainda há atualizações pendentes
                                      const hasActiveUpdates = Object.values(newState).some((v) => v === true);
                                      if (!hasActiveUpdates) {
                                        isUpdatingRef.current = false;
                                      }
                                      return newState;
                                    });
                                  }
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
          );
        })}
      </div>
    </div>
  );
}
