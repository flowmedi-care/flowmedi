"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Mail, MessageSquare, Send, Clock, ListTodo, CheckCircle, Settings2, UserCheck, Eye, Plus, FileText, CalendarCheck, Calendar, XCircle, UserX } from "lucide-react";
import { processEvent, concluirEvent, getMessagePreviewForEvent, type ClinicEventConfigItem } from "./actions";
import { EventosConfigModal } from "./eventos-config-modal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { registerPatientFromPublicForm } from "@/app/dashboard/pacientes/actions";
import { updateAppointment } from "@/app/dashboard/agenda/actions";
import { toast } from "@/components/ui/toast";
import type { MessageEvent, ClinicMessageSetting, MessageTemplate, EffectiveTemplateItem } from "@/app/dashboard/mensagens/actions";
import type { MessagePreviewItem } from "@/lib/message-processor";
import { getChannelSendState } from "@/lib/event-send-logic";

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

// Consulta é hoje (data do agendamento = hoje no fuso do usuário)
function isAppointmentToday(scheduledAt: string | null): boolean {
  if (!scheduledAt) return false;
  const d = new Date(scheduledAt);
  const today = new Date();
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
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
  appointment_status?: string | null;
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
  patientIdsWithAppointment = [],
  appointmentIdsNeedingForm = [],
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
  patientIdsWithAppointment?: string[];
  appointmentIdsNeedingForm?: string[];
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
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    preview: MessagePreviewItem[];
    eventName?: string;
    patientName?: string;
    error?: string;
  } | null>(null);

  const templateNameById = useMemo(() => {
    const m = new Map<string, string>();
    templates.forEach((t) => m.set(t.id, t.name));
    systemTemplates.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [templates, systemTemplates]);

  function getTemplateNameForEvent(event: Event, channel: "email" | "whatsapp"): string {
    const templateId =
      event.template_ids?.[channel] ??
      settings.find((s) => s.event_code === event.event_code && s.channel === channel)?.template_id;
    if (!templateId) return "Template padrão";
    return templateNameById.get(templateId) ?? "Template padrão";
  }

  async function openPreview(eventId: string) {
    setPreviewLoading(true);
    setPreviewData(null);
    setPreviewOpen(true);
    const res = await getMessagePreviewForEvent(eventId);
    setPreviewData({
      preview: res.preview ?? [],
      eventName: res.eventName,
      patientName: res.patientName,
      error: res.error ?? undefined,
    });
    setPreviewLoading(false);
  }

  function getChannelStatus(event: Event) {
    const state = getChannelSendState(event, settings);
    return {
      emailEnabled: state.email.enabled,
      whatsappEnabled: state.whatsapp.enabled,
      emailSent: state.email.alreadySent,
      whatsappSent: state.whatsapp.alreadySent,
      allDisabled: state.allDisabled,
      allSent: state.allSent,
      enabledChannels: [
        ...(state.email.enabled ? (["email"] as const) : []),
        ...(state.whatsapp.enabled ? (["whatsapp"] as const) : []),
      ],
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
      toast(result.error, "error");
      alert(`Erro: ${result.error}`);
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

  async function handleAppointmentStatusChange(appointmentId: string, status: "realizada" | "falta" | "cancelada") {
    setUpdatingAppointmentId(appointmentId);
    const res = await updateAppointment(appointmentId, { status });
    setUpdatingAppointmentId(null);
    if (res.error) {
      toast(`Erro: ${res.error}`, "error");
    } else {
      toast(status === "realizada" ? "Consulta marcada como realizada" : status === "falta" ? "Consulta marcada como falta" : "Consulta cancelada", "success");
      router.refresh();
    }
  }

  async function handleCadastrarFromEvent(event: Event) {
    const meta = (event.metadata || {}) as Record<string, unknown>;
    const email = meta.public_submitter_email as string | undefined;
    if (!email) {
      alert("E-mail do formulário não encontrado.");
      return;
    }
    setRegisteringEventId(event.id);
    const res = await registerPatientFromPublicForm(
      email,
      {
        full_name: (meta.public_submitter_name as string) || "Sem nome",
        phone: (meta.public_submitter_phone as string) || null,
        birth_date: (meta.public_submitter_birth_date as string) || null,
        custom_fields: (meta.public_submitter_custom_fields as Record<string, unknown>) || undefined,
      },
      event.id
    );
    setRegisteringEventId(null);
    if (res.error) {
      alert(`Erro: ${res.error}`);
    } else {
      toast("Paciente cadastrado com sucesso", "success");
      router.refresh();
    }
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
              {/* Ícones de canais — verde quando enviado */}
              {event.channels && event.channels.length > 0 && (() => {
                const ch = getChannelStatus(event);
                return (
                  <div className="flex gap-1">
                    {event.channels.map((channel) => {
                      const isSent = channel === "email" ? ch.emailSent : channel === "whatsapp" ? ch.whatsappSent : false;
                      return (
                        <div
                          key={channel}
                          className={isSent ? "text-green-600" : "text-muted-foreground"}
                          title={isSent ? `${channel === "email" ? "Email" : "WhatsApp"} já enviado` : undefined}
                        >
                          {CHANNEL_ICONS[channel]}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Formulário público: dados do solicitante + Cadastrar ou "Usuário cadastrado" */}
          {event.event_code === "public_form_completed" && (() => {
            if (event.patient_id) {
              return (
                <div className="mb-4 p-3 rounded-md bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <UserCheck className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="font-medium text-green-700">Usuário cadastrado</span>
                    {event.patient_name && (
                      <span className="text-muted-foreground">— {event.patient_name}</span>
                    )}
                  </div>
                </div>
              );
            }
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
          {/* Formulário de paciente preenchido: ação Entrar em contato (email e WhatsApp) */}
          {event.event_code === "patient_form_completed" && (
            <div className="mb-4 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Ação recomendada:</strong> Entrar em contato (email e WhatsApp)
              </p>
              {event.patient_name && (
                <p className="text-xs text-muted-foreground mt-1">Paciente: {event.patient_name}</p>
              )}
            </div>
          )}
          {/* Falta registrada: ação Remarcar consulta + entrar em contato */}
          {event.event_code === "appointment_no_show" && event.appointment_id && (
            <div className="mb-4 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                Ação recomendada: Remarcar consulta
              </p>
              <Button asChild size="sm" variant="outline" className="border-amber-300 dark:border-amber-700">
                <Link href={`/dashboard/agenda/consulta/${event.appointment_id}`}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Remarcar consulta
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                E/ou entrar em contato (email e WhatsApp) usando o botão Enviar abaixo.
              </p>
            </div>
          )}
          {/* Consulta realizada: ação Agendar retorno */}
          {event.event_code === "appointment_completed" && event.appointment_id && (
            <div className="mb-4 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Ação recomendada: Agendar retorno
              </p>
              <Button asChild size="sm" variant="outline" className="border-blue-300 dark:border-blue-700">
                <Link href={`/dashboard/agenda/consulta/${event.appointment_id}`}>
                  <CalendarCheck className="h-4 w-4 mr-2" />
                  Agendar retorno
                </Link>
              </Button>
            </div>
          )}
          {/* Consulta agendada: ação Vincular formulário ou confirmação de já vinculado */}
          {event.event_code === "appointment_created" && event.appointment_id && (
            appointmentIdsNeedingForm.includes(event.appointment_id) ? (
              <div className="mb-4 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Ação recomendada:</strong> Vincular formulário a esta consulta
                  </span>
                  <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300 dark:border-amber-700">
                    <Link href={`/dashboard/agenda/consulta/${event.appointment_id}?tab=formularios`}>
                      <FileText className="h-4 w-4 mr-2" />
                      Vincular formulário
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 rounded-md bg-muted/50 border border-border">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="font-medium text-green-700">Formulário vinculado</span>
                  {event.patient_name && (
                    <span className="text-muted-foreground">— {event.patient_name}</span>
                  )}
                </div>
              </div>
            )
          )}
          {/* Usuário cadastrado: Nova consulta ou "Consulta agendada" se já tiver consulta */}
          {event.event_code === "patient_registered" && event.patient_id && (() => {
            const hasAppointment = patientIdsWithAppointment.includes(event.patient_id);
            if (hasAppointment) {
              return (
                <div className="mb-4 p-3 rounded-md bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="font-medium text-green-700">Consulta agendada</span>
                    {event.patient_name && (
                      <span className="text-muted-foreground">— {event.patient_name}</span>
                    )}
                  </div>
                </div>
              );
            }
            const meta = (event.metadata || {}) as Record<string, unknown>;
            const doctorId = meta.doctor_id as string | undefined;
            const href = doctorId
              ? `/dashboard/consulta?patientId=${event.patient_id}&doctorId=${doctorId}`
              : `/dashboard/consulta?patientId=${event.patient_id}`;
            return (
              <div className="mb-4 p-3 rounded-md bg-muted/50 border border-border">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {event.patient_name && (
                    <span className="text-sm text-muted-foreground">
                      Paciente: <strong>{event.patient_name}</strong>
                    </span>
                  )}
                  <Button asChild size="sm" className="shrink-0">
                    <Link href={href}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova consulta
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })()}
          {/* Consulta remarcada / confirmada / agendada: no dia da consulta — botões ou confirmação se já executou */}
          {event.appointment_id &&
            event.appointment_scheduled_at &&
            isAppointmentToday(event.appointment_scheduled_at) &&
            ["appointment_rescheduled", "appointment_confirmed", "appointment_created"].includes(event.event_code) &&
            (() => {
              const apptStatus = event.appointment_status ?? null;
              if (apptStatus === "realizada" || apptStatus === "falta" || apptStatus === "cancelada") {
                const label =
                  apptStatus === "realizada"
                    ? "Consulta marcada como realizada"
                    : apptStatus === "falta"
                      ? "Consulta marcada como falta"
                      : "Consulta marcada como cancelada";
                return (
                  <div className="mb-4 p-3 rounded-md bg-muted/50 border border-border space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      <span className="font-medium text-green-700 dark:text-green-300">✓ {label}</span>
                      {event.patient_name && (
                        <span className="text-muted-foreground">— {event.patient_name}</span>
                      )}
                    </div>
                    {apptStatus === "realizada" && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Ação recomendada: Agendar retorno</p>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/agenda/consulta/${event.appointment_id}`}>
                            <CalendarCheck className="h-4 w-4 mr-2" />
                            Agendar retorno
                          </Link>
                        </Button>
                      </div>
                    )}
                    {apptStatus === "falta" && (
                      <div className="pt-2 border-t border-border">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/agenda/consulta/${event.appointment_id}`}>
                            <Calendar className="h-4 w-4 mr-2" />
                            Remarcar consulta
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div className="mb-4 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    Ação recomendada: no dia da consulta
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-600 text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-950/50"
                      onClick={() => handleAppointmentStatusChange(event.appointment_id!, "realizada")}
                      disabled={updatingAppointmentId === event.appointment_id}
                    >
                      <CalendarCheck className="h-4 w-4 mr-1" />
                      {updatingAppointmentId === event.appointment_id ? "..." : "Marcar como realizada"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-600 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/50"
                      onClick={() => handleAppointmentStatusChange(event.appointment_id!, "falta")}
                      disabled={updatingAppointmentId === event.appointment_id}
                    >
                      <UserX className="h-4 w-4 mr-1" />
                      {updatingAppointmentId === event.appointment_id ? "..." : "Marcar como falta"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-600 text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/50"
                      onClick={() => handleAppointmentStatusChange(event.appointment_id!, "cancelada")}
                      disabled={updatingAppointmentId === event.appointment_id}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      {updatingAppointmentId === event.appointment_id ? "..." : "Marcar como cancelada"}
                    </Button>
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
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate sm:text-2xl">Central de Eventos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie todos os eventos: todos, pendentes e concluídos
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto min-h-[44px] sm:min-h-9 touch-manipulation shrink-0"
          onClick={() => setConfigOpen(true)}
        >
          <Settings2 className="h-4 w-4 mr-2 shrink-0" />
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
            const emailTemplateName = getTemplateNameForEvent(sendModalEvent, "email");
            const whatsappTemplateName = getTemplateNameForEvent(sendModalEvent, "whatsapp");
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {sendModalEvent.event_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Enviar por email / WhatsApp usando o template selecionado.{" "}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="inline-flex gap-1"
                    onClick={() => openPreview(sendModalEvent.id)}
                  >
                    <Eye className="h-4 w-4" />
                    Ver preview
                  </Button>
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={ch.emailSent ? "text-green-600" : ""}>
                      {CHANNEL_ICONS.email}
                    </span>
                    <span className="text-sm">Email</span>
                    <span className="text-xs text-muted-foreground">— {emailTemplateName}</span>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={ch.whatsappSent ? "text-green-600" : ""}>
                      {CHANNEL_ICONS.whatsapp}
                    </span>
                    <span className="text-sm">WhatsApp</span>
                    <span className="text-xs text-muted-foreground">— {whatsappTemplateName}</span>
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
                        handleProcessEvent(sendModalEvent.id, "send", [...sendModalChannels])
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent title="Preview da mensagem" onClose={() => setPreviewOpen(false)}>
          {previewLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : previewData?.error ? (
            <p className="text-sm text-destructive">{previewData.error}</p>
          ) : previewData && previewData.preview.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {previewData.eventName && (
                  <Badge variant="secondary">Evento: {previewData.eventName}</Badge>
                )}
                {previewData.patientName && (
                  <Badge variant="outline">Paciente: {previewData.patientName}</Badge>
                )}
              </div>
              {previewData.preview.map((item) => (
                <div key={item.channel} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {item.channel === "email" ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                    {item.channel === "email" ? "Email" : "WhatsApp"}
                    {item.templateName && (
                      <span className="text-muted-foreground font-normal">— {item.templateName}</span>
                    )}
                  </div>
                  {item.channel === "email" && item.subject && (
                    <div>
                      <p className="text-xs text-muted-foreground">Assunto</p>
                      <p className="text-sm rounded bg-muted/50 p-2">{item.subject}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Corpo</p>
                    <div
                      className="text-sm rounded bg-muted/50 p-3 prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: item.body }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : previewData ? (
            <p className="text-sm text-muted-foreground">Nenhum template configurado para este evento.</p>
          ) : null}
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
