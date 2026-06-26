export type JourneyPhase = "captacao" | "pre_consulta" | "consulta" | "pos_consulta";

export type JourneyStepCode =
  | "primeiro_contato"
  | "aguardando_retorno"
  | "cadastro_pendente"
  | "cadastrado"
  | "consulta_agendada"
  | "consulta_confirmada"
  | "formulario_pendente"
  | "formulario_ok"
  | "consulta_realizada"
  | "consulta_falta"
  | "consulta_cancelada"
  | "retorno_sugerido"
  | "retorno_agendado"
  | "jornada_concluida";

export type JourneyContactType = "lead" | "patient";

export type JourneySource = "form" | "whatsapp" | "site" | "manual";

export type SuggestedActionKind =
  | "register_patient"
  | "contact_lead"
  | "schedule_appointment"
  | "link_form"
  | "send_form_reminder"
  | "reschedule_appointment"
  | "schedule_return"
  | "mark_appointment_done"
  | "view_event"
  | "none";

export type SuggestedAction = {
  kind: SuggestedActionKind;
  label: string;
  description?: string;
  href?: string;
  eventId?: string;
  appointmentId?: string;
  patientId?: string;
  metadata?: Record<string, unknown>;
};

export type JourneyTimelineEntry = {
  id: string;
  type: "event" | "pipeline_history";
  title: string;
  description?: string;
  occurredAt: string;
  status?: string;
  eventCode?: string;
};

export type JourneyEventRef = {
  id: string;
  event_code: string;
  event_name: string;
  status: string;
  patient_id: string | null;
  appointment_id: string | null;
  appointment_scheduled_at: string | null;
  appointment_status?: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  patient_name?: string | null;
};

export type ContactJourney = {
  contactKey: string;
  contactType: JourneyContactType;
  pipelineId?: string;
  patientId?: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  source: JourneySource;
  currentStep: JourneyStepCode;
  completedSteps: JourneyStepCode[];
  phase: JourneyPhase;
  pendingEvents: JourneyEventRef[];
  suggestedAction: SuggestedAction | null;
  appointmentId?: string;
  appointmentStatus?: string | null;
  appointmentScheduledAt?: string | null;
  timeline: JourneyTimelineEntry[];
  updatedAt: string;
};

export type JourneyListFilters = {
  phase?: JourneyPhase;
  source?: JourneySource;
  withPendingAction?: boolean;
};

export type JourneyActionContext = {
  appointmentIdsNeedingForm: string[];
  patientIdsWithAppointment: string[];
  isAppointmentToday: (scheduledAt: string | null) => boolean;
};
