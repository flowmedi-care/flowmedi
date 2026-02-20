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
      current?.template_id ?? null,
      current?.send_only_when_ticket_open ?? false
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
      current?.template_id ?? null,
      current?.send_only_when_ticket_open ?? false
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
      templateId,
      current.send_only_when_ticket_open ?? false
    );
    if (res.error) alert(`Erro: ${res.error}`);
    else if (res.data) onSettingsChange(mergeSetting(settings, res.data));
    setUpdating((p) => ({ ...p, [key]: false }));
  }

  async function handleTicketOpenOnlyChange(
    eventCode: string,
    sendOnlyWhenTicketOpen: boolean
  ) {
    const key = `${eventCode}-whatsapp-ticket-open`;
    setUpdating((p) => ({ ...p, [key]: true }));
    const current = getSetting(eventCode, "whatsapp");
    if (!current) {
      setUpdating((p) => ({ ...p, [key]: false }));
      return;
    }
    const res = await updateClinicMessageSetting(
      eventCode,
      "whatsapp",
      current.enabled,
      current.send_mode,
      current.template_id,
      sendOnlyWhenTicketOpen
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
        className="max-w-4xl max-h-[85vh] flex flex-col"
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

                    const emailTemplates = getTemplatesForEvent(code, "email");
                    const wppTemplates = getTemplatesForEvent(code, "whatsapp");
                    const emailTemplateLabel =
                      emailSetting?.template_id
                        ? emailTemplates.find((t) => t.id === emailSetting.template_id)?.name ??
                          systemTemplateNameMap[`${code}:email`] ??
                          "Padrão do sistema"
                        : systemTemplateNameMap[`${code}:email`] ?? "Padrão do sistema";
                    const wppTemplateLabel =
                      wppSetting?.template_id
                        ? wppTemplates.find((t) => t.id === wppSetting.template_id)?.name ??
                          systemTemplateNameMap[`${code}:whatsapp`] ??
                          "Padrão do sistema"
                        : systemTemplateNameMap[`${code}:whatsapp`] ?? "Padrão do sistema";

                    return (
                      <Card key={code} className="p-4">
                        <div className="space-y-4">
                          <div>
                            <p className="font-medium text-sm text-foreground">{event.name ?? code}</p>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {event.description}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
                            {/* Sistema — coluna fixa, sem overlap */}
                            <div className="flex items-center gap-2 md:min-w-[120px]">
                              <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Switch
                                  checked={sysOn}
                                  onChange={(v) => handleSystemToggle(code, v)}
                                  disabled={updating[`system-${code}`]}
                                />
                                <span className="text-sm font-medium">Sistema</span>
                              </label>
                            </div>

                            {/* Email — bloco com Envio + Template em linhas */}
                            <div className="space-y-3 min-w-0 md:min-w-[200px]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium flex items-center gap-2 shrink-0">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                  Email
                                </span>
                                <Switch
                                  checked={emailSetting?.enabled ?? false}
                                  onChange={(v) => handleChannelToggle(code, "email", v)}
                                  disabled={updating[`${code}-email`]}
                                />
                              </div>
                              {(emailSetting?.enabled ?? false) && (
                                <div className="space-y-2 pl-6">
                                  <div>
                                    <label className="text-xs text-muted-foreground block mb-1">
                                      Envio
                                    </label>
                                    <select
                                      value={emailSetting?.send_mode ?? "manual"}
                                      onChange={(e) =>
                                        handleSendModeChange(code, "email", e.target.value as SendMode)
                                      }
                                      className="h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"
                                    >
                                      <option value="automatic">Automático</option>
                                      <option value="manual">Manual</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-xs text-muted-foreground block mb-1">
                                      Template
                                    </label>
                                    <select
                                      value={emailSetting?.template_id ?? ""}
                                      onChange={(e) =>
                                        handleTemplateChange(
                                          code,
                                          "email",
                                          e.target.value?.trim() || null
                                        )
                                      }
                                      title={emailTemplateLabel}
                                      className="h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm truncate block"
                                    >
                                      <option value="">
                                        {systemTemplateNameMap[`${code}:email`] ?? "Padrão do sistema"}
                                      </option>
                                      {emailTemplates.map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.name ?? t.id}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* WhatsApp — mesmo padrão */}
                            <div className="space-y-3 min-w-0 md:min-w-[200px]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium flex items-center gap-2 shrink-0">
                                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                  WhatsApp
                                </span>
                                <Switch
                                  checked={wppSetting?.enabled ?? false}
                                  onChange={(v) => handleChannelToggle(code, "whatsapp", v)}
                                  disabled={updating[`${code}-whatsapp`]}
                                />
                              </div>
                              {(wppSetting?.enabled ?? false) && (
                                <div className="space-y-2 pl-6">
                                  <div>
                                    <label className="text-xs text-muted-foreground block mb-1">
                                      Envio
                                    </label>
                                    <select
                                      value={wppSetting?.send_mode ?? "manual"}
                                      onChange={(e) =>
                                        handleSendModeChange(
                                          code,
                                          "whatsapp",
                                          e.target.value as SendMode
                                        )
                                      }
                                      className="h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"
                                    >
                                      <option value="automatic">Automático</option>
                                      <option value="manual">Manual</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-xs text-muted-foreground block mb-1">
                                      Template
                                    </label>
                                    <select
                                      value={wppSetting?.template_id ?? ""}
                                      onChange={(e) =>
                                        handleTemplateChange(
                                          code,
                                          "whatsapp",
                                          e.target.value?.trim() || null
                                        )
                                      }
                                      title={wppTemplateLabel}
                                      className="h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm truncate block"
                                    >
                                      <option value="">
                                        {systemTemplateNameMap[`${code}:whatsapp`] ?? "Padrão do sistema"}
                                      </option>
                                      {wppTemplates.map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.name ?? t.id}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex items-center gap-2 pt-1">
                                    <input
                                      type="checkbox"
                                      id={`${code}-whatsapp-ticket-open`}
                                      checked={wppSetting?.send_only_when_ticket_open ?? false}
                                      onChange={(e) =>
                                        handleTicketOpenOnlyChange(code, e.target.checked)
                                      }
                                      disabled={updating[`${code}-whatsapp-ticket-open`]}
                                      className="h-4 w-4 rounded border-input"
                                    />
                                    <label
                                      htmlFor={`${code}-whatsapp-ticket-open`}
                                      className="text-xs text-muted-foreground cursor-pointer"
                                    >
                                      Enviar somente com ticket aberto
                                    </label>
                                  </div>
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
      </DialogContent>
    </Dialog>
  );
}
