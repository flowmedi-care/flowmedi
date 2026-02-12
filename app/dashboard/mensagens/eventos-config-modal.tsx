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
} from "./actions";
import { Mail, MessageSquare } from "lucide-react";

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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: MessageEvent[];
  settings: ClinicMessageSetting[];
  templates: MessageTemplate[];
  onSettingsChange: (next: ClinicMessageSetting[]) => void;
};

export function EventosConfigModal({
  open,
  onOpenChange,
  events,
  settings,
  templates,
  onSettingsChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<"email" | "whatsapp">("email");
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

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

  const applyUpdate = useCallback(
    (updated: ClinicMessageSetting | null) => {
      if (updated) onSettingsChange(mergeSetting(settings, updated));
    },
    [settings, onSettingsChange]
  );

  async function handleToggle(
    eventCode: string,
    channel: "email" | "whatsapp",
    enabled: boolean
  ) {
    const key = `${eventCode}-${channel}`;
    setUpdating((p) => ({ ...p, [key]: true }));
    const current = getSetting(eventCode, channel);
    try {
      const result = await updateClinicMessageSetting(
        eventCode,
        channel,
        enabled,
        current?.send_mode ?? "manual",
        current?.template_id ?? null
      );
      if (result.error) alert(`Erro: ${result.error}`);
      else applyUpdate(result.data);
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
    try {
      const result = await updateClinicMessageSetting(
        eventCode,
        channel,
        current?.enabled ?? false,
        sendMode,
        current?.template_id ?? null
      );
      if (result.error) alert(`Erro: ${result.error}`);
      else applyUpdate(result.data);
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
      if (result.error) alert(`Erro: ${result.error}`);
      else applyUpdate(result.data);
    } finally {
      setUpdating((p) => ({ ...p, [key]: false }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Configurar eventos (Email e WhatsApp)"
        onClose={() => onOpenChange(false)}
        className="max-w-2xl max-h-[85vh] flex flex-col"
      >
        <div className="flex gap-2 border-b pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("email")}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors -mb-px ${
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
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors -mb-px ${
              activeTab === "whatsapp"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="h-4 w-4 inline mr-2" />
            WhatsApp
          </button>
        </div>

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
                    const setting = getSetting(code, activeTab);
                    const enabled = setting?.enabled ?? false;
                    const sendMode = setting?.send_mode ?? "manual";
                    const canBeAutomatic = event.can_be_automatic ?? false;
                    const key = `${code}-${activeTab}`;
                    const isLoading =
                      updating[key] === true ||
                      updating[`${key}-mode`] === true ||
                      updating[`${key}-template`] === true;

                    return (
                      <Card key={`${category}-${code}`} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm">
                              {event.name ?? code}
                            </p>
                            {event.description != null &&
                              event.description !== "" && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {event.description}
                                </p>
                              )}
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
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
                                  <span className="text-xs text-muted-foreground">
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
                                    className="h-7 rounded border border-input bg-background px-2 text-xs"
                                  >
                                    <option value="automatic">Automático</option>
                                    <option value="manual">Manual</option>
                                  </select>
                                </div>
                              )}
                              {enabled && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    Template:
                                  </span>
                                  <select
                                    value={setting?.template_id ?? ""}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      handleTemplateChange(
                                        code,
                                        activeTab,
                                        v && v.trim() ? v : null
                                      );
                                    }}
                                    disabled={isLoading}
                                    className="h-7 rounded border border-input bg-background px-2 text-xs"
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
      </DialogContent>
    </Dialog>
  );
}
