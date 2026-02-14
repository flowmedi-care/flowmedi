"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Mail, MessageSquare, Send, Clock, ListTodo, CheckCircle, Settings2, UserCheck } from "lucide-react";
import { processEvent, concluirEvent, type ClinicEventConfigItem } from "./actions";
import { EventosConfigModal } from "./eventos-config-modal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { registerPatientFromPublicForm } from "@/app/dashboard/pacientes/actions";
import type { MessageEvent, ClinicMessageSetting, MessageTemplate, EffectiveTemplateItem } from "@/app/dashboard/mensagens/actions";

// Formatação de data
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  whatsapp: <MessageSquare className="h-4 w-4" />,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  sent: "bg-green-100 text-green-800 border-green-300",
  completed_without_send: "bg-blue-100 text-blue-800 border-blue-300",
  completed: "bg-blue-100 text-blue-800 border-blue-300",
  ignored: "bg-gray-100 text-gray-800 border-gray-300",
  failed: "bg-red-100 text-red-800 border-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  completed_without_send: "Concluído sem envio",
  completed: "Concluído",
  ignored: "Ignorado",
  failed: "Falhou",
};

type Event = {
  id: string;
  event_code: string;
  event_name: string;
  event_category: string;
  patient_id: string | null;
  patient_name: string | null;
  appointment_id: string | null;
  appointment_scheduled_at: string | null;
  form_instance_id: string | null;
  status: string;
  origin: string;
  occurred_at: string;
  created_at?: string;
  processed_at?: string | null;
  processed_by?: string | null;
  processed_by_name?: string | null;
  channels: string[];
  sent_channels?: string[];
  template_ids: Record<string, string>;
  variables: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

type Patient = {
  id: string;
  full_name: string;
};

type EventType = {
  code: string;
  name: string;
  category: string;
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

export function EventosClient({
  initialPendingEvents,
  initialAllEvents,
  initialCompletedEvents,
  patients,
  eventTypes,
  eventConfig,
  msgEvents,
  msgSettings,
  templates,
  systemTemplates = [],
}: {
  initialPendingEvents: Event[];
  initialAllEvents: Event[];
  initialCompletedEvents: Event[];
  patients: Patient[];
  eventTypes: EventType[];
  eventConfig: ClinicEventConfigItem[];
  msgEvents: MessageEvent[];
  msgSettings: ClinicMessageSetting[];
  templates: MessageTemplate[];
  systemTemplates?: EffectiveTemplateItem[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "completed">("pending");
  const [configOpen, setConfigOpen] = useState(false);
  const [pendingEvents, setPendingEvents] = useState<Event[]>(initialPendingEvents);
  const [allEvents, setAllEvents] = useState<Event[]>(initialAllEvents);
  const [completedEvents, setCompletedEvents] = useState<Event[]>(initialCompletedEvents);
  const [settings, setSettings] = useState<ClinicMessageSetting[]>(msgSettings);

  useEffect(() => {
    setPendingEvents(initialPendingEvents);
    setAllEvents(initialAllEvents);
    setCompletedEvents(initialCompletedEvents);
  }, [initialPendingEvents, initialAllEvents, initialCompletedEvents]);
  const [eventConfigState, setEventConfigState] = useState<ClinicEventConfigItem[]>(eventConfig);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [patientFilter, setPatientFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [sendModalEvent, setSendModalEvent] = useState<Event | null>(null);
  const [sendModalChannels, setSendModalChannels] = useState<("email" | "whatsapp")[]>([]);
  const [registeringEventId, setRegisteringEventId] = useState<string | null>(null);

  function getChannelStatus(event: Event) {
    const enabledForEvent = settings.filter(
      (s) => s.event_code === event.event_code && s.enabled
    );
    const enabledChannels = enabledForEvent.map((s) => s.channel);
    const sent = event.sent_channels ?? [];
    const emailEnabled = enabledChannels.includes("email");
    const whatsappEnabled = enabledChannels.includes("whatsapp");
    const emailSent = sent.includes("email");
    const whatsappSent = sent.includes("whatsapp");
    const allDisabled = !emailEnabled && !whatsappEnabled;
    const allSent =
      enabledChannels.length > 0 &&
      enabledChannels.every((c) => sent.includes(c));
    return {
      emailEnabled,
      whatsappEnabled,
      emailSent,
      whatsappSent,
      allDisabled,
      allSent,
      enabledChannels: enabledChannels as ("email" | "whatsapp")[],
    };
  }

  const filterFn = (e: Event) => {
    if (patientFilter !== "all" && e.patient_id !== patientFilter) return false;
    if (eventFilter !== "all" && e.event_code !== eventFilter) return false;
    return true;
  };
  const filteredPending = pendingEvents.filter(filterFn);
  const filteredAll = allEvents.filter(filterFn);
  const filteredCompleted = completedEvents.filter(filterFn);

  async function handleProcessEvent(
    eventId: string,
    action: "send" | "mark_ok",
    channelsToSend?: ("email" | "whatsapp")[]
  ) {
    if (action === "send" && (!channelsToSend || channelsToSend.length === 0))
      return;
    const actionLabel = action === "send" ? "enviar" : "marcar como ok";
    if (!channelsToSend && !confirm(`Deseja ${actionLabel} este evento?`))
      return;

    setProcessing(eventId);
    const result = await processEvent(eventId, action, channelsToSend);
    setProcessing(null);

    if (result.error) {
      alert(`Erro: ${result.error}`);
    } else if (result.testMode && result.eventId) {
      router.push(`/dashboard/eventos/teste?eventId=${result.eventId}`);
    } else {
      setSendModalEvent(null);
      setSendModalChannels([]);
      router.refresh();
    }
  }

  async function handleConcluir(eventId: string) {
    setProcessing(eventId);
    const result = await concluirEvent(eventId);
    setProcessing(null);
    if (result.error) alert(`Erro: ${result.error}`);
    else router.refresh();
  }

  async function handleCadastrarFromEvent(event: Event) {
    const meta = (event.metadata || {}) as Record<string, unknown>;
    const email = meta.public_submitter_email as string | undefined;
    if (!email) {
      alert("E-mail do formulário não encontrado.");
      return;
    }
    setRegisteringEventId(event.id);
    const res = await registerPatientFromPublicForm(email, {
      full_name: (meta.public_submitter_name as string) || "Sem nome",
      phone: (meta.public_submitter_phone as string) || null,
      birth_date: (meta.public_submitter_birth_date as string) || null,
      custom_fields: (meta.public_submitter_custom_fields as Record<string, unknown>) || undefined,
    });
    setRegisteringEventId(null);
    if (res.error) alert(`Erro: ${res.error}`);
    else router.refresh();
  }

  function EventCard({ event }: { event: Event }) {
    const isExpanded = expanded === event.id;
    const isProcessing = processing === event.id;
    const isPending = event.status === "pending";

    return (
      <Card key={event.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className={STATUS_COLORS[event.status] || STATUS_COLORS.pending}
                >
                  {STATUS_LABELS[event.status] || event.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {event.event_category}
                </span>
              </div>
              <CardTitle className="text-lg">{event.event_name}</CardTitle>
              {event.patient_name && (
                <p className="text-sm text-muted-foreground mt-1">
                  Paciente: <strong>{event.patient_name}</strong>
                </p>
              )}
              {event.appointment_scheduled_at && (
                <p className="text-sm text-muted-foreground">
                  Consulta: {formatDate(event.appointment_scheduled_at)}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Ocorreu em: {formatDate(event.occurred_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Ícones de canais */}
              {event.channels && event.channels.length > 0 && (
                <div className="flex gap-1">
                  {event.channels.map((channel) => (
                    <div key={channel} className="text-muted-foreground">
                      {CHANNEL_ICONS[channel]}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Formulário público: dados do solicitante + ação recomendada Cadastrar */}
          {event.event_code === "public_form_completed" && !event.patient_id && (() => {
            const meta = (event.metadata || {}) as Record<string, unknown>;
            const nome = (meta.public_submitter_name as string) || null;
            const email = (meta.public_submitter_email as string) || null;
            const telefone = (meta.public_submitter_phone as string) || null;
            const canRegister = !!email;
            return (
              <div className="mb-4 p-3 rounded-md bg-muted/50 border border-border">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 text-sm">
                    {nome != null && (
                      <p><strong>Nome:</strong> {nome}</p>
                    )}
                    {email != null && (
                      <p><strong>Email:</strong> {email}</p>
                    )}
                    {telefone != null && (
                      <p><strong>Telefone:</strong> {telefone}</p>
                    )}
                    {!nome && !email && !telefone && (
                      <p className="text-muted-foreground">Dados do formulário não disponíveis.</p>
                    )}
                  </div>
                  {canRegister && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleCadastrarFromEvent(event)}
                      disabled={registeringEventId === event.id}
                      title="Cadastrar paciente"
                      className="shrink-0"
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      {registeringEventId === event.id ? "Cadastrando..." : "Cadastrar"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
            <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap items-center">
              {isPending && (() => {
                const ch = getChannelStatus(event);
                if (ch.allDisabled)
                  return (
                    <span className="text-sm text-muted-foreground">
                      Envio desativado
                    </span>
                  );
                if (ch.allSent)
                  return (
                    <span className="text-sm text-muted-foreground">
                      Já enviado
                    </span>
                  );
                return (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSendModalEvent(event);
                      setSendModalChannels([]);
                    }}
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Enviar
                  </Button>
                );
              })()}
              {isPending && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleConcluir(event.id)}
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Concluir
                </Button>
              )}
              {!isPending && event.processed_at && (
                <div className="text-sm text-muted-foreground">
                  Processado em: {formatDate(event.processed_at)}
                  {event.processed_by_name && ` por ${event.processed_by_name}`}
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded(isExpanded ? null : event.id)}
            >
              {isExpanded ? "Ocultar" : "Detalhes"}
            </Button>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t space-y-2 text-sm">
              <div>
                <strong>Origem:</strong> {event.origin}
              </div>
              {(() => {
                const ch = getChannelStatus(event);
                return (
                  <div>
                    <strong>Envio:</strong>
                    <ul className="mt-1 list-disc list-inside">
                      {ch.allDisabled ? (
                        <li>Envio desativado para este evento</li>
                      ) : (
                        <>
                          <li>
                            Email: {ch.emailEnabled ? (ch.emailSent ? "enviado" : "pendente") : "desativado"}
                          </li>
                          <li>
                            WhatsApp: {ch.whatsappEnabled ? (ch.whatsappSent ? "enviado" : "pendente") : "desativado"}
                          </li>
                        </>
                      )}
                    </ul>
                  </div>
                );
              })()}
              {event.channels && event.channels.length > 0 && (
                <div>
                  <strong>Canais configurados:</strong> {event.channels.join(", ")}
                </div>
              )}
              {(event.sent_channels?.length ?? 0) > 0 && (
                <div>
                  <strong>Enviado por:</strong> {(event.sent_channels ?? []).join(", ")}
                </div>
              )}
              {Object.keys(event.variables || {}).length > 0 && (
                <div>
                  <strong>Variáveis:</strong>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                    {JSON.stringify(event.variables, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Central de Eventos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie todos os eventos: todos, pendentes e concluídos
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
          <Settings2 className="h-4 w-4 mr-2" />
          Configurar eventos
        </Button>
      </div>

      <EventosConfigModal
        open={configOpen}
        onOpenChange={setConfigOpen}
        events={msgEvents}
        settings={settings}
        eventConfig={eventConfigState}
        templates={templates}
        systemTemplates={systemTemplates}
        onSettingsChange={(next) => { setSettings(next); router.refresh(); }}
        onEventConfigChange={(next) => { setEventConfigState(next); router.refresh(); }}
      />

      <Dialog
        open={!!sendModalEvent}
        onOpenChange={(open) => {
          if (!open) {
            setSendModalEvent(null);
            setSendModalChannels([]);
          }
        }}
      >
        <DialogContent
          title="Enviar mensagem"
          onClose={() => {
            setSendModalEvent(null);
            setSendModalChannels([]);
          }}
        >
          {sendModalEvent && (() => {
            const ch = getChannelStatus(sendModalEvent);
            const canSendEmail = ch.emailEnabled && !ch.emailSent;
            const canSendWhatsApp = ch.whatsappEnabled && !ch.whatsappSent;
            const hasChoice = canSendEmail || canSendWhatsApp;
            const toggle = (c: "email" | "whatsapp") => {
              setSendModalChannels((prev) =>
                prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
              );
            };
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {sendModalEvent.event_name}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {CHANNEL_ICONS.email}
                    <span className="text-sm">Email</span>
                    {!ch.emailEnabled && (
                      <span className="text-xs text-muted-foreground">(desativado)</span>
                    )}
                    {ch.emailEnabled && ch.emailSent && (
                      <span className="text-xs text-green-600">Já enviado</span>
                    )}
                    {canSendEmail && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendModalChannels.includes("email")}
                          onChange={() => toggle("email")}
                          className="rounded border-input"
                        />
                        Enviar por email
                      </label>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {CHANNEL_ICONS.whatsapp}
                    <span className="text-sm">WhatsApp</span>
                    {!ch.whatsappEnabled && (
                      <span className="text-xs text-muted-foreground">(desativado)</span>
                    )}
                    {ch.whatsappEnabled && ch.whatsappSent && (
                      <span className="text-xs text-green-600">Já enviado</span>
                    )}
                    {canSendWhatsApp && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendModalChannels.includes("whatsapp")}
                          onChange={() => toggle("whatsapp")}
                          className="rounded border-input"
                        />
                        Enviar por WhatsApp
                      </label>
                    )}
                  </div>
                </div>
                {hasChoice && (
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSendModalEvent(null);
                        setSendModalChannels([]);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() =>
                        handleProcessEvent(sendModalEvent.id, "send", sendModalChannels)
                      }
                      disabled={
                        sendModalChannels.length === 0 || processing === sendModalEvent.id
                      }
                      className="flex items-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      Enviar
                    </Button>
                  </div>
                )}
                {!hasChoice && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum canal disponível para envio.
                  </p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Filtrar por paciente</label>
              <select
                value={patientFilter}
                onChange={(e) => setPatientFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">Todos os pacientes</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Filtrar por evento</label>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">Todos os eventos</option>
                {eventTypes.map((et) => (
                  <option key={et.code} value={et.code}>
                    {et.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Todos, Pendentes, Concluídos */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2",
            activeTab === "all"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <ListTodo className="h-4 w-4" />
          Todos ({filteredAll.length})
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2",
            activeTab === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Clock className="h-4 w-4" />
          Pendentes ({filteredPending.length})
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2",
            activeTab === "completed"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <CheckCircle className="h-4 w-4" />
          Concluídos ({filteredCompleted.length})
        </button>
      </div>

      <div className="space-y-4">
        {activeTab === "all" && (
          <>
            {filteredAll.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Nenhum evento encontrado.</p>
              </Card>
            ) : (
              filteredAll.map((event) => <EventCard key={event.id} event={event} />)
            )}
          </>
        )}
        {activeTab === "pending" && (
          <>
            {filteredPending.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Nenhum evento pendente encontrado.</p>
              </Card>
            ) : (
              filteredPending.map((event) => <EventCard key={event.id} event={event} />)
            )}
          </>
        )}
        {activeTab === "completed" && (
          <>
            {filteredCompleted.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Nenhum evento concluído encontrado.</p>
              </Card>
            ) : (
              filteredCompleted.map((event) => <EventCard key={event.id} event={event} />)
            )}
          </>
        )}
      </div>
    </div>
  );
}
