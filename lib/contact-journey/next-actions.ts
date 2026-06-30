import type {
  JourneyActionContext,
  JourneyEventRef,
  JourneyStepCode,
  SuggestedAction,
} from "./types";

export type NextActionInput = {
  currentStep: JourneyStepCode;
  pendingEvents: JourneyEventRef[];
  contactType: "lead" | "patient";
  patientId?: string;
  email?: string | null;
  appointmentId?: string;
  appointmentStatus?: string | null;
  hasPendingForms?: boolean;
  context: JourneyActionContext;
};

function isAppointmentToday(scheduledAt: string | null): boolean {
  if (!scheduledAt) return false;
  const d = new Date(scheduledAt);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

export function resolveSuggestedAction(input: NextActionInput): SuggestedAction | null {
  const {
    pendingEvents,
    contactType,
    patientId,
    email,
    appointmentId,
    currentStep,
    hasPendingForms,
    context,
  } = input;

  const pendingSorted = [...pendingEvents].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );

  for (const event of pendingSorted) {
    const fromEvent = suggestedActionFromEvent(event, context);
    if (fromEvent) return fromEvent;
  }

  if (contactType === "lead") {
    if (currentStep === "primeiro_contato" || currentStep === "cadastro_pendente") {
      if (email) {
        return {
          kind: "register_patient",
          label: "Cadastrar paciente",
          description: "Converter lead em paciente cadastrado",
        };
      }
      return {
        kind: "contact_lead",
        label: "Entrar em contato",
        description: "Qualificar o lead e registrar retorno",
      };
    }
    if (currentStep === "aguardando_retorno") {
      return {
        kind: "contact_lead",
        label: "Entrar em contato",
        description: "Follow-up com o lead",
      };
    }
    if (currentStep === "cadastrado") {
      const href = email
        ? `/dashboard/agenda?new=true&patientEmail=${encodeURIComponent(email)}`
        : "/dashboard/agenda?new=true";
      return {
        kind: "schedule_appointment",
        label: "Agendar consulta",
        description: "Marcar primeira consulta do paciente",
        href,
      };
    }
  }

  if (patientId && currentStep === "cadastrado") {
    return {
      kind: "schedule_appointment",
      label: "Agendar consulta",
      description: "Marcar consulta para o paciente",
      href: `/dashboard/consulta?patientId=${patientId}`,
      patientId,
    };
  }

  if (appointmentId && hasPendingForms) {
    return {
      kind: "link_form",
      label: "Vincular formulário",
      description: "Formulário pendente nesta consulta",
      href: `/dashboard/agenda/atendimento/${appointmentId}`,
      appointmentId,
    };
  }

  if (currentStep === "formulario_pendente" && appointmentId) {
    return {
      kind: "send_form_reminder",
      label: "Enviar lembrete de formulário",
      description: "Paciente ainda não respondeu o formulário",
      href: `/dashboard/eventos`,
      appointmentId,
    };
  }

  if (currentStep === "consulta_falta" && appointmentId) {
    return {
      kind: "reschedule_appointment",
      label: "Remarcar consulta",
      href: `/dashboard/agenda/consulta/${appointmentId}`,
      appointmentId,
    };
  }

  if (
    (currentStep === "consulta_realizada" || currentStep === "retorno_sugerido") &&
    appointmentId
  ) {
    return {
      kind: "schedule_return",
      label: "Agendar retorno",
      href: `/dashboard/agenda/consulta/${appointmentId}`,
      appointmentId,
    };
  }

  if (currentStep === "orcamento_enviado") {
    return {
      kind: "view_quote",
      label: "Acompanhar orçamento",
      description: "Orçamento enviado aguardando resposta",
      href: "/dashboard/vendas/orcamentos",
    };
  }

  if (currentStep === "pagamento_pendente" || currentStep === "pagamento_parcial") {
    return {
      kind: "collect_payment",
      label: "Registrar pagamento",
      description: "Cobrança pendente do paciente",
      href: appointmentId
        ? `/dashboard/agenda/consulta/${appointmentId}`
        : "/dashboard/financeiro",
      appointmentId,
    };
  }

  if (currentStep === "checkin_pendente" && appointmentId) {
    return {
      kind: "view_event",
      label: "Fazer check-in",
      description: "Consulta hoje — confirmar presença",
      href: `/dashboard/agenda/consulta/${appointmentId}`,
      appointmentId,
    };
  }

  return null;
}

export function suggestedActionFromEvent(
  event: JourneyEventRef,
  context: JourneyActionContext
): SuggestedAction | null {
  const { appointmentIdsNeedingForm, patientIdsWithAppointment } = context;

  if (event.event_code === "public_form_completed" && !event.patient_id) {
    const meta = event.metadata || {};
    const email = (meta.public_submitter_email as string) || null;
    if (email) {
      return {
        kind: "register_patient",
        label: "Cadastrar paciente",
        description: "Formulário público preenchido",
        eventId: event.id,
        metadata: meta,
      };
    }
  }

  if (event.event_code === "patient_form_completed") {
    return {
      kind: "view_event",
      label: "Entrar em contato",
      description: "Formulário de paciente preenchido — enviar mensagem",
      eventId: event.id,
      href: "/dashboard/eventos",
    };
  }

  if (event.event_code === "appointment_no_show" && event.appointment_id) {
    return {
      kind: "reschedule_appointment",
      label: "Remarcar consulta",
      eventId: event.id,
      appointmentId: event.appointment_id,
      href: `/dashboard/agenda/consulta/${event.appointment_id}`,
    };
  }

  if (event.event_code === "appointment_completed" && event.appointment_id) {
    return {
      kind: "schedule_return",
      label: "Agendar retorno",
      eventId: event.id,
      appointmentId: event.appointment_id,
      href: `/dashboard/agenda/consulta/${event.appointment_id}`,
    };
  }

  if (event.event_code === "appointment_created" && event.appointment_id) {
    if (appointmentIdsNeedingForm.includes(event.appointment_id)) {
      return {
        kind: "link_form",
        label: "Vincular formulário",
        eventId: event.id,
        appointmentId: event.appointment_id,
        href: `/dashboard/agenda/atendimento/${event.appointment_id}`,
      };
    }
  }

  if (event.event_code === "patient_registered" && event.patient_id) {
    if (!patientIdsWithAppointment.includes(event.patient_id)) {
      const meta = event.metadata || {};
      const doctorId = meta.doctor_id as string | undefined;
      const href = doctorId
        ? `/dashboard/consulta?patientId=${event.patient_id}&doctorId=${doctorId}`
        : `/dashboard/consulta?patientId=${event.patient_id}`;
      return {
        kind: "schedule_appointment",
        label: "Nova consulta",
        eventId: event.id,
        patientId: event.patient_id,
        href,
      };
    }
  }

  if (
    event.appointment_id &&
    event.appointment_scheduled_at &&
    isAppointmentToday(event.appointment_scheduled_at) &&
    ["appointment_rescheduled", "appointment_confirmed", "appointment_created"].includes(
      event.event_code
    )
  ) {
    const apptStatus = event.appointment_status ?? null;
    if (apptStatus === "realizada") {
      return {
        kind: "schedule_return",
        label: "Agendar retorno",
        appointmentId: event.appointment_id,
        href: `/dashboard/agenda/consulta/${event.appointment_id}`,
        eventId: event.id,
      };
    }
    if (apptStatus === "falta") {
      return {
        kind: "reschedule_appointment",
        label: "Remarcar consulta",
        appointmentId: event.appointment_id,
        href: `/dashboard/agenda/consulta/${event.appointment_id}`,
        eventId: event.id,
      };
    }
    if (!apptStatus || apptStatus === "agendada" || apptStatus === "confirmada") {
      return {
        kind: "mark_appointment_done",
        label: "Marcar status da consulta",
        description: "Consulta é hoje — registrar realizada, falta ou cancelada",
        appointmentId: event.appointment_id,
        eventId: event.id,
      };
    }
  }

  if (event.event_code === "form_reminder") {
    return {
      kind: "send_form_reminder",
      label: "Enviar lembrete de formulário",
      eventId: event.id,
      href: "/dashboard/eventos",
    };
  }

  return null;
}

export function getEventActionBanner(event: JourneyEventRef, context: JourneyActionContext): {
  action: SuggestedAction | null;
  completedMessage?: string;
} {
  if (event.event_code === "public_form_completed" && event.patient_id) {
    return { action: null, completedMessage: "Usuário cadastrado" };
  }

  if (event.event_code === "appointment_created" && event.appointment_id) {
    if (!context.appointmentIdsNeedingForm.includes(event.appointment_id)) {
      return { action: null, completedMessage: "Formulário vinculado" };
    }
  }

  if (event.event_code === "patient_registered" && event.patient_id) {
    if (context.patientIdsWithAppointment.includes(event.patient_id)) {
      return { action: null, completedMessage: "Consulta agendada" };
    }
  }

  const action = suggestedActionFromEvent(event, context);
  return { action };
}
