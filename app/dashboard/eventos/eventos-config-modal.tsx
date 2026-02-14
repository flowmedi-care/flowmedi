"use client";

import { useState, useMemo, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  MessageEvent,
  ClinicMessageSetting,
  MessageTemplate,
  SendMode,
  updateClinicMessageSetting,
  type EffectiveTemplateItem,
} from "@/app/dashboard/mensagens/actions";
import { updateClinicEventConfig, type ClinicEventConfigItem } from "./actions";
import { Mail, MessageSquare, Settings2 } from "lucide-react";

type EventSettingsMap = Record<
  string,
  { email?: ClinicMessageSetting; whatsapp?: ClinicMessageSetting }
>;

const CATEGORY_ORDER = ["agendamento", "lembrete", "formulario", "pos_consulta", "outros"];
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: MessageEvent[];
  settings: ClinicMessageSetting[];
  eventConfig: ClinicEventConfigItem[];
  templates: MessageTemplate[];
  systemTemplates?: EffectiveTemplateItem[];
  onSettingsChange: (next: ClinicMessageSetting[]) => void;
  onEventConfigChange: (next: ClinicEventConfigItem[]) => void;
};

export function EventosConfigModal({
  open,
  onOpenChange,
  events,
  settings,
  eventConfig,
  templates,
  systemTemplates = [],
  onSettingsChange,
  onEventConfigChange,
}: Props) {
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  const systemTemplateNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    systemTemplates.forEach((t) => {
      map[`${t.event_code}:${t.channel}`] = t.name;
    });
    return map;
  }, [systemTemplates]);

  const eventConfigMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    eventConfig.forEach((c) => {
      map[c.event_code] = c.system_enabled;
    });
    events.forEach((e) => {
      if (e?.code && map[e.code] === undefined) map[e.code] = true;
    });
    return map;
  }, [eventConfig, events]);

  const eventSettingsMap: EventSettingsMap = useMemo(() => {
    const map: EventSettingsMap = {};
    events.forEach((e) => {
      if (e?.code) map[e.code] = {};
    });
    settings.forEach((s) => {
      if (!s?.event_code || !s?.channel) return;
      if (!map[s.event_code]) map[s.event_code] = {};
      if (s.channel === "email") map[s.event_code].email = s;
      else map[s.event_code].whatsapp = s;
    });
    return map;
  }, [events, settings]);

  const eventsByCategory = useMemo(() => {
    const map: Record<string, MessageEvent[]> = {};
    events.forEach((e) => {
      const cat = e?.category ?? "outros";
      if (!map[cat]) map[cat] = [];
      map[cat].push(e);
    });
    return map;
  }, [events]);

  const orderedCategories = useMemo(() => {
    const keys = Object.keys(eventsByCategory);
    const known = new Set(CATEGORY_ORDER);
    return [...CATEGORY_ORDER.filter((c) => keys.includes(c)), ...keys.filter((k) => !known.has(k))];
  }, [eventsByCategory]);

  const getSetting = useCallback(
    (eventCode: string, channel: "email" | "whatsapp") => eventSettingsMap[eventCode]?.[channel],
    [eventSettingsMap]
  );

  const getTemplatesForEvent = useCallback(
    (eventCode: string, channel: "email" | "whatsapp") =>
      templates.filter(
        (t) => t.event_code === eventCode && t.channel === channel && t.is_active
      ),
    [templates]
  );

  const systemEnabled = useCallback(
    (eventCode: string) => eventConfigMap[eventCode] !== false,
    [eventConfigMap]
  );

  async function handleSystemToggle(eventCode: string, enabled: boolean) {
    const key = `system-${eventCode}`;
    setUpdating((p) => ({ ...p, [key]: true }));
    const res = await updateClinicEventConfig(eventCode, enabled);
    if (res.error) alert(`Erro: ${res.error}`);
    else
      onEventConfigChange(
        eventConfig.map((c) => (c.event_code === eventCode ? { ...c, system_enabled: enabled } : c))
      );
    setUpdating((p) => ({ ...p, [key]: false }));
  }

  async function handleChannelToggle(
    eventCode: string,
    channel: "email" | "whatsapp",
    enabled: boolean
  ) {
    const key = `${eventCode}-${channel}`;
    setUpdating((p) => ({ ...p, [key]: true }));
    const current = getSetting(eventCode, channel);
    const res = await updateClinicMessageSetting(
      eventCode,
      channel,
      enabled,
      current?.send_mode ?? "manual",
      current?.template_id ?? null
    );
    if (res.error) alert(`Erro: ${res.error}`);
    else if (res.data) onSettingsChange(mergeSetting(settings, res.data));
    setUpdating((p) => ({ ...p, [key]: false }));
  }

  async function handleSendModeChange(
    eventCode: string,
    channel: "email" | "whatsapp",
    sendMode: SendMode
  ) {
    const key = `${eventCode}-${channel}-mode`;
    setUpdating((p) => ({ ...p, [key]: true }));
    const current = getSetting(eventCode, channel);
    const res = await updateClinicMessageSetting(
      eventCode,
      channel,
      current?.enabled ?? false,
      sendMode,
      current?.template_id ?? null
    );
    if (res.error) alert(`Erro: ${res.error}`);
    else if (res.data) onSettingsChange(mergeSetting(settings, res.data));
    setUpdating((p) => ({ ...p, [key]: false }));
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
    const res = await updateClinicMessageSetting(
      eventCode,
      channel,
      current.enabled,
      current.send_mode,
      templateId
    );
    if (res.error) alert(`Erro: ${res.error}`);
    else if (res.data) onSettingsChange(mergeSetting(settings, res.data));
    setUpdating((p) => ({ ...p, [key]: false }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Configurar eventos"
        onClose={() => onOpenChange(false)}
        className="max-w-3xl max-h-[85vh] flex flex-col"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Sistema (on/off) define se o evento aparece em Pendentes. Email e WhatsApp: ative e escolha
          automático ou manual. Tudo em uma única tela.
        </p>
        <div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-2">
          {orderedCategories.map((category) => {
            const categoryEvents = eventsByCategory[category] ?? [];
            return (
              <section key={category}>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  {CATEGORY_LABELS[category] ?? category}
                </h3>
                <div className="space-y-2">
                  {categoryEvents.map((event) => {
                    const code = event?.code;
                    if (!code) return null;
                    const emailSetting = getSetting(code, "email");
                    const wppSetting = getSetting(code, "whatsapp");
                    const sysOn = systemEnabled(code);
                    const canBeAutomatic = event.can_be_automatic ?? false;

                    return (
                      <Card key={code} className="p-3">
                        <div className="flex flex-col gap-3">
                          <div>
                            <p className="font-medium text-sm text-foreground">{event.name ?? code}</p>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {event.description}
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            {/* Sistema */}
                            <div className="flex items-center gap-2">
                              <Settings2 className="h-4 w-4 text-muted-foreground" />
                              <label className="flex items-center gap-2">
                                <Switch
                                  checked={sysOn}
                                  onChange={(v) => handleSystemToggle(code, v)}
                                  disabled={updating[`system-${code}`]}
                                />
                                <span>Sistema</span>
                              </label>
                            </div>
                            {/* Email */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 font-medium">
                                <Mail className="h-4 w-4" />
                                Email
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Switch
                                  checked={emailSetting?.enabled ?? false}
                                  onChange={(v) => handleChannelToggle(code, "email", v)}
                                  disabled={updating[`${code}-email`]}
                                />
                                {(emailSetting?.enabled ?? false) && canBeAutomatic && (
                                  <select
                                    value={emailSetting?.send_mode ?? "manual"}
                                    onChange={(e) =>
                                      handleSendModeChange(code, "email", e.target.value as SendMode)
                                    }
                                    className="h-7 rounded border border-input bg-background px-2 text-xs"
                                  >
                                    <option value="automatic">Automático</option>
                                    <option value="manual">Manual</option>
                                  </select>
                                )}
                                {(emailSetting?.enabled ?? false) && (
                                  <select
                                    value={emailSetting?.template_id ?? ""}
                                    onChange={(e) =>
                                      handleTemplateChange(
                                        code,
                                        "email",
                                        e.target.value?.trim() || null
                                      )
                                    }
                                    className="h-7 rounded border border-input bg-background px-2 text-xs"
                                  >
                                    <option value="">
                                      {systemTemplateNameMap[`${code}:email`] ?? "Padrão do sistema"}
                                    </option>
                                    {getTemplatesForEvent(code, "email").map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name ?? t.id}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>
                            {/* WhatsApp */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 font-medium">
                                <MessageSquare className="h-4 w-4" />
                                WhatsApp
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Switch
                                  checked={wppSetting?.enabled ?? false}
                                  onChange={(v) => handleChannelToggle(code, "whatsapp", v)}
                                  disabled={updating[`${code}-whatsapp`]}
                                />
                                {(wppSetting?.enabled ?? false) && canBeAutomatic && (
                                  <select
                                    value={wppSetting?.send_mode ?? "manual"}
                                    onChange={(e) =>
                                      handleSendModeChange(
                                        code,
                                        "whatsapp",
                                        e.target.value as SendMode
                                      )
                                    }
                                    className="h-7 rounded border border-input bg-background px-2 text-xs"
                                  >
                                    <option value="automatic">Automático</option>
                                    <option value="manual">Manual</option>
                                  </select>
                                )}
                                {(wppSetting?.enabled ?? false) && (
                                  <select
                                    value={wppSetting?.template_id ?? ""}
                                    onChange={(e) =>
                                      handleTemplateChange(
                                        code,
                                        "whatsapp",
                                        e.target.value?.trim() || null
                                      )
                                    }
                                    className="h-7 rounded border border-input bg-background px-2 text-xs"
                                  >
                                    <option value="">
                                      {systemTemplateNameMap[`${code}:whatsapp`] ?? "Padrão do sistema"}
                                    </option>
                                    {getTemplatesForEvent(code, "whatsapp").map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name ?? t.id}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
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
      </DialogContent>
    </Dialog>
  );
}
