import {
  APPOINTMENT_STATUS_TO_STEP,
  COMANDA_STATUS_TO_STEP,
  getCompletedStepsUpTo,
  getStepDefinition,
  LIFECYCLE_TO_STEP,
  PIPELINE_STAGE_TO_STEP,
  QUOTE_STATUS_TO_STEP,
} from "./steps";
import { buildActivePathSteps, buildParallelTracks } from "./active-path";
import { classifyContactIntent } from "./intent-classifier";
import { formatJourneyContextForAi } from "./contextual-resume";
import { resolveSuggestedAction } from "./next-actions";
import type {
  ComandaSnapshot,
  ContactIntent,
  ContactJourney,
  JourneyActionContext,
  JourneyEventRef,
  JourneyPhase,
  JourneySource,
  JourneyStepCode,
  JourneyTimelineEntry,
  LifecycleStageCode,
  LossConfidence,
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

const VALID_SOURCES = new Set<string>([
  "form",
  "site",
  "whatsapp",
  "whatsapp_direct",
  "whatsapp_ads",
  "public_site",
  "manual",
  "indicacao",
  "ligacao",
  "campanha",
  "reativacao_campanha",
]);

function inferLeadSource(lead: PipelineLeadInput): JourneySource {
  if (lead.source && VALID_SOURCES.has(lead.source)) {
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
    return "objecao_identificada";
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

    if (appt.status === "agendada") {
      return pickMostUrgentStep(["compliance_2d_enviado", quoteStep, comandaStep]);
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

function inferContactIntent(
  contactType: "lead" | "patient",
  currentStep: JourneyStepCode,
  patient?: PatientJourneyInput,
  lead?: PipelineLeadInput
): ContactIntent {
  if (currentStep === "pesquisa_nps_enviada" || currentStep === "feedback_recebido") {
    return "pos_atendimento";
  }
  if (["suporte_iniciado", "suporte_concluido", "reclamacao_escalada"].includes(currentStep)) {
    return "suporte";
  }
  if (
    ["orcamento_enviado", "pagamento_sinal_pendente", "comprovante_recebido", "pagamento_pendente", "pagamento_parcial"].includes(
      currentStep
    )
  ) {
    return "financeiro";
  }
  if (["repescagem_ativa", "reativacao_iniciada", "reativacao_concluida"].includes(currentStep)) {
    return "reativacao";
  }

  const hasFutureAppt =
    patient?.appointment != null &&
    ["agendada", "confirmada"].includes(patient.appointment.status) &&
    new Date(patient.appointment.scheduled_at) > new Date();

  return classifyContactIntent({
    isNewNumber: contactType === "lead" && lead?.stage === "novo_contato",
    hasFutureAppointment: hasFutureAppt,
    hasCompletedAppointment: patient?.hasCompletedAppointment ?? false,
    isInactivePatient: patient?.hasCompletedAppointment === true && !hasFutureAppt,
    isLeadInPipeline: contactType === "lead",
    currentStep,
  });
}

function inferLossConfidence(lossReason: string | null | undefined): LossConfidence | null {
  if (!lossReason) return null;
  if (lossReason === "nao_respondeu" || lossReason === "motivo_nao_identificado") return "baixa";
  if (["preco", "horario", "distancia", "indecisao"].includes(lossReason)) return "alta";
  return "media";
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

  const contactIntent = classifyContactIntent({
    isNewNumber: lead.stage === "novo_contato",
    hasFutureAppointment: lead.stage === "agendado",
    hasCompletedAppointment: false,
    isInactivePatient: false,
    isLeadInPipeline: true,
    currentStep,
  });

  const base = {
    contactKey: `lead-${lead.id}`,
    contactType: "lead" as const,
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
    lossReason: lead.loss_reason,
    contactIntent,
    activePathSteps: buildActivePathSteps(currentStep, completedSteps, contactIntent),
    parallelTracks: buildParallelTracks({
      currentStep,
      quotes: lead.quotes,
      contactIntent,
    }),
    motivoProvavel: lead.loss_reason,
    lossConfidence: inferLossConfidence(lead.loss_reason),
  };

  return base;
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

  const contactIntent = inferContactIntent("patient", currentStep, patient);

  return {
    contactKey: `patient-${patient.id}`,
    contactType: "patient",
    contactIntent,
    patientId: patient.id,
    displayName: patient.full_name,
    email: patient.email,
    phone: patient.phone,
    source,
    lifecycleStage: resolveLifecycleStage(undefined, patient),
    currentStep,
    completedSteps,
    activePathSteps: buildActivePathSteps(currentStep, completedSteps, contactIntent),
    parallelTracks: buildParallelTracks({
      currentStep,
      quotes: patient.quotes,
      comandas: patient.comandas,
      contactIntent,
    }),
    phase,
    pendingEvents,
    suggestedAction,
    appointmentId: patient.appointment?.id,
    appointmentStatus: patient.appointment?.status ?? null,
    appointmentScheduledAt: patient.appointment?.scheduled_at ?? null,
    lossReason: null,
    motivoProvavel: null,
    lossConfidence: null,
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
    contactIntent?: ContactIntent;
    withPendingAction?: boolean;
    awaitingResponse?: boolean;
  }
): ContactJourney[] {
  return journeys.filter((j) => {
    if (filters?.phase && j.phase !== filters.phase) return false;
    if (filters?.source && j.source !== filters.source) return false;
    if (filters?.lifecycleStage && j.lifecycleStage !== filters.lifecycleStage) return false;
    if (filters?.contactIntent && j.contactIntent !== filters.contactIntent) return false;
    if (filters?.withPendingAction && !j.suggestedAction) return false;
    if (filters?.awaitingResponse) {
      const current = j.activePathSteps.find((s) => s.status === "current");
      if (!current?.awaitsResponse) return false;
    }
    return true;
  });
}

export function formatJourneySummaryForAi(journey: ContactJourney): string {
  return formatJourneyContextForAi(journey);
}
