import {
  APPOINTMENT_STATUS_TO_STEP,
  COMANDA_STATUS_TO_STEP,
  getCompletedStepsUpTo,
  getStepDefinition,
  LIFECYCLE_TO_STEP,
  PIPELINE_STAGE_TO_STEP,
  QUOTE_STATUS_TO_STEP,
} from "./steps";
import { resolveSuggestedAction } from "./next-actions";
import type {
  ComandaSnapshot,
  ContactJourney,
  JourneyActionContext,
  JourneyEventRef,
  JourneyPhase,
  JourneySource,
  JourneyStepCode,
  JourneyTimelineEntry,
  LifecycleStageCode,
  QuoteSnapshot,
  RepescagemSnapshot,
  TreatmentPlanSnapshot,
} from "./types";

export type PipelineLeadInput = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  stage: string;
  lifecycle_stage?: string | null;
  source?: string | null;
  loss_reason?: string | null;
  lead_score?: number;
  temperature_override?: string | null;
  updated_at: string;
  history: Array<{
    id: string;
    action_type: string;
    old_stage: string | null;
    new_stage: string | null;
    notes: string | null;
    created_at: string;
  }>;
  hasPublicForm: boolean;
  quotes?: QuoteSnapshot[];
};

export type PatientJourneyInput = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  updated_at: string;
  hasCompletedAppointment?: boolean;
  lifecycle_stage?: LifecycleStageCode;
  appointment?: {
    id: string;
    status: string;
    scheduled_at: string;
    is_return?: boolean;
    encounter_status?: string | null;
    checked_in?: boolean;
  } | null;
  pendingFormCount: number;
  respondedFormCount: number;
  quotes?: QuoteSnapshot[];
  comandas?: ComandaSnapshot[];
  treatmentPlan?: TreatmentPlanSnapshot | null;
  repescagem?: RepescagemSnapshot | null;
};

function inferLeadSource(lead: PipelineLeadInput): JourneySource {
  if (lead.source && ["form", "site", "whatsapp", "manual"].includes(lead.source)) {
    return lead.source as JourneySource;
  }
  if (lead.hasPublicForm) return "form";
  return "manual";
}

function resolveQuoteStep(quotes?: QuoteSnapshot[]): JourneyStepCode | null {
  if (!quotes?.length) return null;
  const priority = ["enviado", "rascunho", "aceito", "recusado", "expirado"];
  for (const status of priority) {
    const match = quotes.find((q) => q.status === status);
    if (match) return QUOTE_STATUS_TO_STEP[match.status] ?? null;
  }
  return QUOTE_STATUS_TO_STEP[quotes[0].status] ?? null;
}

function resolveComandaStep(comandas?: ComandaSnapshot[]): JourneyStepCode | null {
  if (!comandas?.length) return null;
  const open = comandas.find((c) => c.status === "aberta");
  if (open) return "pagamento_pendente";
  const partial = comandas.find((c) => c.status === "parcial");
  if (partial) return "pagamento_parcial";
  const paid = comandas.find((c) => c.status === "paga");
  if (paid) return "pago";
  return null;
}

function pickMostUrgentStep(candidates: (JourneyStepCode | null)[]): JourneyStepCode {
  const valid = candidates.filter((c): c is JourneyStepCode => Boolean(c));
  if (valid.length === 0) return "primeiro_contato";
  return valid.sort(
    (a, b) => getStepDefinition(b).order - getStepDefinition(a).order
  )[0];
}

function resolveLeadStep(lead: PipelineLeadInput, pendingEvents: JourneyEventRef[]): JourneyStepCode {
  if (lead.lifecycle_stage === "perdido" || lead.loss_reason) {
    return "consulta_cancelada";
  }

  const hasPublicFormPending = pendingEvents.some(
    (e) => e.event_code === "public_form_completed" && !e.patient_id
  );
  if (hasPublicFormPending) return "cadastro_pendente";

  const quoteStep = resolveQuoteStep(lead.quotes);
  const lifecycleStep = lead.lifecycle_stage
    ? LIFECYCLE_TO_STEP[lead.lifecycle_stage]
    : null;
  const pipelineStep = PIPELINE_STAGE_TO_STEP[lead.stage] ?? "primeiro_contato";

  return pickMostUrgentStep([quoteStep, lifecycleStep, pipelineStep]);
}

function resolvePatientStep(
  patient: PatientJourneyInput,
  pendingEvents: JourneyEventRef[],
  context: JourneyActionContext
): JourneyStepCode {
  if (patient.repescagem?.status === "ativo") {
    return "repescagem_ativa";
  }

  const appt = patient.appointment;
  const hasReturnPending = pendingEvents.some((e) => e.event_code === "appointment_completed");

  if (patient.treatmentPlan && (patient.treatmentPlan.sessions_remaining ?? 0) > 0) {
    return pickMostUrgentStep([
      "plano_tratamento_ativo",
      appt ? APPOINTMENT_STATUS_TO_STEP[appt.status] : null,
    ]);
  }

  if (hasReturnPending && appt?.status === "realizada") {
    return "retorno_sugerido";
  }

  if (appt?.is_return && ["agendada", "confirmada"].includes(appt.status)) {
    return "retorno_agendado";
  }

  const comandaStep = resolveComandaStep(patient.comandas);
  const quoteStep = resolveQuoteStep(patient.quotes);

  if (appt) {
    if (appt.encounter_status === "em_andamento") {
      return "em_atendimento";
    }

    if (
      appt.status === "confirmada" &&
      context.isAppointmentToday(appt.scheduled_at) &&
      !appt.checked_in
    ) {
      return pickMostUrgentStep(["checkin_pendente", comandaStep]);
    }

    if (appt.status === "realizada") {
      if (appt.encounter_status === "finalizado_aguardando_cobranca") {
        return pickMostUrgentStep(["pagamento_pendente", "retorno_sugerido"]);
      }
      return pickMostUrgentStep([comandaStep, "consulta_realizada", "retorno_sugerido"]);
    }

    if (patient.pendingFormCount > 0 && ["agendada", "confirmada"].includes(appt.status)) {
      if (appt.status === "confirmada") {
        return pickMostUrgentStep(["formulario_pendente", quoteStep]);
      }
      return pickMostUrgentStep([APPOINTMENT_STATUS_TO_STEP[appt.status], quoteStep]);
    }

    if (patient.respondedFormCount > 0 && ["agendada", "confirmada"].includes(appt.status)) {
      return appt.status === "confirmada"
        ? pickMostUrgentStep(["formulario_ok", quoteStep])
        : pickMostUrgentStep(["consulta_agendada", quoteStep]);
    }

    return pickMostUrgentStep([
      APPOINTMENT_STATUS_TO_STEP[appt.status],
      quoteStep,
      comandaStep,
    ]);
  }

  if (patient.hasCompletedAppointment) {
    return pickMostUrgentStep([comandaStep, "jornada_concluida"]);
  }

  return pickMostUrgentStep([quoteStep, "cadastrado"]);
}

function buildTimelineFromHistory(
  history: PipelineLeadInput["history"],
  events: JourneyEventRef[],
  quotes?: QuoteSnapshot[]
): JourneyTimelineEntry[] {
  const entries: JourneyTimelineEntry[] = [];

  for (const h of history) {
    entries.push({
      id: `history-${h.id}`,
      type: "pipeline_history",
      title:
        h.action_type === "stage_change"
          ? `Estágio: ${h.new_stage ?? "—"}`
          : h.action_type === "registered"
            ? "Paciente cadastrado"
            : h.action_type === "contact_made"
              ? "Contato registrado"
              : h.action_type === "note_added"
                ? "Nota adicionada"
                : h.action_type,
      description: h.notes ?? undefined,
      occurredAt: h.created_at,
    });
  }

  for (const e of events) {
    entries.push({
      id: `event-${e.id}`,
      type: "event",
      title: e.event_name,
      description: e.patient_name ?? undefined,
      occurredAt: e.occurred_at,
      status: e.status,
      eventCode: e.event_code,
    });
  }

  for (const q of quotes ?? []) {
    entries.push({
      id: `quote-${q.id}`,
      type: "quote",
      title: `Orçamento: ${q.status}`,
      occurredAt: q.created_at,
      status: q.status,
    });
  }

  return entries.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}

function resolveLifecycleStage(
  lead?: PipelineLeadInput,
  patient?: PatientJourneyInput
): LifecycleStageCode | undefined {
  if (patient?.hasCompletedAppointment || patient?.lifecycle_stage === "cliente") {
    return "cliente";
  }
  if (lead?.lifecycle_stage && lead.lifecycle_stage !== "perdido") {
    return lead.lifecycle_stage as LifecycleStageCode;
  }
  if (lead?.loss_reason || lead?.lifecycle_stage === "perdido") return "perdido";
  if (patient?.appointment && ["agendada", "confirmada"].includes(patient.appointment.status)) {
    return "oportunidade";
  }
  return lead?.lifecycle_stage as LifecycleStageCode | undefined;
}

export function buildLeadJourney(
  lead: PipelineLeadInput,
  pendingEvents: JourneyEventRef[],
  context: JourneyActionContext
): ContactJourney {
  const currentStep = resolveLeadStep(lead, pendingEvents);
  const completedSteps = getCompletedStepsUpTo(currentStep);
  const phase = getStepDefinition(currentStep).phase;

  const suggestedAction = resolveSuggestedAction({
    currentStep,
    pendingEvents,
    contactType: "lead",
    email: lead.email,
    context,
    hasPendingForms: false,
  });

  return {
    contactKey: `lead-${lead.id}`,
    contactType: "lead",
    pipelineId: lead.id,
    displayName: lead.name || lead.email,
    email: lead.email,
    phone: lead.phone,
    source: inferLeadSource(lead),
    lifecycleStage: resolveLifecycleStage(lead),
    leadScore: lead.lead_score,
    temperature: lead.temperature_override ?? undefined,
    currentStep,
    completedSteps,
    phase,
    pendingEvents,
    suggestedAction,
    timeline: buildTimelineFromHistory(lead.history, pendingEvents, lead.quotes),
    updatedAt: lead.updated_at,
  };
}

export function buildPatientJourney(
  patient: PatientJourneyInput,
  pendingEvents: JourneyEventRef[],
  context: JourneyActionContext,
  source: JourneySource = "manual"
): ContactJourney {
  const currentStep = resolvePatientStep(patient, pendingEvents, context);
  const completedSteps = getCompletedStepsUpTo(currentStep);
  const phase = getStepDefinition(currentStep).phase;

  const suggestedAction = resolveSuggestedAction({
    currentStep,
    pendingEvents,
    contactType: "patient",
    patientId: patient.id,
    email: patient.email,
    appointmentId: patient.appointment?.id,
    appointmentStatus: patient.appointment?.status ?? null,
    hasPendingForms: patient.pendingFormCount > 0,
    context,
  });

  return {
    contactKey: `patient-${patient.id}`,
    contactType: "patient",
    patientId: patient.id,
    displayName: patient.full_name,
    email: patient.email,
    phone: patient.phone,
    source,
    lifecycleStage: resolveLifecycleStage(undefined, patient),
    currentStep,
    completedSteps,
    phase,
    pendingEvents,
    suggestedAction,
    appointmentId: patient.appointment?.id,
    appointmentStatus: patient.appointment?.status ?? null,
    appointmentScheduledAt: patient.appointment?.scheduled_at ?? null,
    timeline: buildTimelineFromHistory([], pendingEvents, patient.quotes),
    updatedAt: patient.updated_at,
  };
}

export function filterJourneys(
  journeys: ContactJourney[],
  filters?: {
    phase?: JourneyPhase;
    source?: JourneySource;
    lifecycleStage?: LifecycleStageCode;
    withPendingAction?: boolean;
  }
): ContactJourney[] {
  return journeys.filter((j) => {
    if (filters?.phase && j.phase !== filters.phase) return false;
    if (filters?.source && j.source !== filters.source) return false;
    if (filters?.lifecycleStage && j.lifecycleStage !== filters.lifecycleStage) return false;
    if (filters?.withPendingAction && !j.suggestedAction) return false;
    return true;
  });
}

export function formatJourneySummaryForAi(journey: ContactJourney): string {
  const step = getStepDefinition(journey.currentStep);
  const action = journey.suggestedAction?.label ?? "Nenhuma ação pendente";
  return [
    `Contato: ${journey.displayName}`,
    `Tipo: ${journey.contactType === "lead" ? "lead" : "paciente"}`,
    journey.lifecycleStage ? `Funil CRM: ${journey.lifecycleStage}` : null,
    `Etapa operacional: ${step.label} (${journey.phase})`,
    `Origem: ${journey.source}`,
    journey.leadScore != null ? `Score: ${journey.leadScore}` : null,
    `Próxima ação sugerida: ${action}`,
    journey.pendingEvents.length > 0
      ? `Eventos pendentes: ${journey.pendingEvents.map((e) => e.event_name).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}
