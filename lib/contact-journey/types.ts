export type JourneyPhase =
  | "captacao"
  | "comercial"
  | "pre_consulta"
  | "consulta"
  | "financeiro"
  | "pos_consulta"
  | "pos_atendimento"
  | "reengajamento";

export type ContactIntent =
  | "captacao"
  | "reativacao"
  | "operacional"
  | "financeiro"
  | "suporte"
  | "pos_atendimento";

export type JourneyStepCode =
  | "primeiro_contato"
  | "origem_identificada"
  | "aguardando_retorno"
  | "qualificacao"
  | "informacoes_enviadas"
  | "negociacao"
  | "fechamento_agendamento"
  | "cadastro_pendente"
  | "cadastrado"
  | "objecao_identificada"
  | "orcamento_rascunho"
  | "orcamento_enviado"
  | "orcamento_aceito"
  | "orcamento_recusado"
  | "orcamento_vencido"
  | "pagamento_sinal_pendente"
  | "comprovante_recebido"
  | "autorizacao_pendente"
  | "autorizacao_convenio_pendente"
  | "consulta_agendada"
  | "agradecimento_agendamento"
  | "compliance_7d_enviado"
  | "compliance_2d_enviado"
  | "sem_resposta_confirmacao"
  | "motivo_nao_confirmacao"
  | "consulta_confirmada"
  | "lembrete_dia_enviado"
  | "reagendamento_confirmado"
  | "formulario_pendente"
  | "formulario_ok"
  | "checkin_pendente"
  | "em_atendimento"
  | "consulta_realizada"
  | "consulta_falta"
  | "consulta_cancelada"
  | "pagamento_pendente"
  | "pagamento_parcial"
  | "pago"
  | "retorno_sugerido"
  | "retorno_agendado"
  | "plano_tratamento_ativo"
  | "pesquisa_nps_enviada"
  | "feedback_recebido"
  | "jornada_concluida"
  | "suporte_iniciado"
  | "suporte_concluido"
  | "reclamacao_escalada"
  | "reativacao_iniciada"
  | "reativacao_concluida"
  | "repescagem_ativa";

export type LifecycleStageCode =
  | "lead_novo"
  | "em_qualificacao"
  | "qualificado"
  | "oportunidade"
  | "cliente"
  | "perdido";

export type JourneyContactType = "lead" | "patient";

export type JourneySource =
  | "form"
  | "whatsapp"
  | "whatsapp_direct"
  | "whatsapp_ads"
  | "site"
  | "public_site"
  | "manual"
  | "indicacao"
  | "ligacao"
  | "campanha"
  | "reativacao_campanha";

export type LossConfidence = "alta" | "media" | "baixa";

export type ParallelTrackKind = "financeiro" | "suporte" | "pos_atendimento";

export type ParallelTrackStep = {
  code: JourneyStepCode;
  label: string;
  status: "completed" | "current" | "upcoming";
};

export type ParallelTrack = {
  kind: ParallelTrackKind;
  label: string;
  steps: ParallelTrackStep[];
};

export type ActivePathStepStatus = "completed" | "current" | "upcoming" | "skipped";

export type ActivePathStep = {
  code: JourneyStepCode;
  label: string;
  shortLabel: string;
  status: ActivePathStepStatus;
  awaitsResponse?: boolean;
  hint?: string;
};

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
  | "collect_payment"
  | "view_quote"
  | "escalate_human"
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
  type: "event" | "pipeline_history" | "quote" | "payment";
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
  contactIntent: ContactIntent;
  pipelineId?: string;
  patientId?: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  source: JourneySource;
  lifecycleStage?: LifecycleStageCode;
  leadScore?: number;
  temperature?: string;
  currentStep: JourneyStepCode;
  completedSteps: JourneyStepCode[];
  activePathSteps: ActivePathStep[];
  parallelTracks: ParallelTrack[];
  phase: JourneyPhase;
  pendingEvents: JourneyEventRef[];
  suggestedAction: SuggestedAction | null;
  appointmentId?: string;
  appointmentStatus?: string | null;
  appointmentScheduledAt?: string | null;
  lossReason?: string | null;
  motivoProvavel?: string | null;
  lossConfidence?: LossConfidence | null;
  timeline: JourneyTimelineEntry[];
  updatedAt: string;
};

export type JourneyListFilters = {
  phase?: JourneyPhase;
  source?: JourneySource;
  lifecycleStage?: LifecycleStageCode;
  contactIntent?: ContactIntent;
  withPendingAction?: boolean;
  awaitingResponse?: boolean;
};

export type JourneyActionContext = {
  appointmentIdsNeedingForm: string[];
  patientIdsWithAppointment: string[];
  isAppointmentToday: (scheduledAt: string | null) => boolean;
};

export type QuoteSnapshot = {
  id: string;
  status: string;
  total_amount: number | null;
  created_at: string;
};

export type ComandaSnapshot = {
  id: string;
  status: string;
  appointment_id: string | null;
};

export type TreatmentPlanSnapshot = {
  id: string;
  sessions_remaining: number | null;
  status: string | null;
};

export type RepescagemSnapshot = {
  id: string;
  status: string;
  source: string;
};
