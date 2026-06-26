import {
  APPOINTMENT_STATUS_TO_STEP,
  getCompletedStepsUpTo,
  getStepDefinition,
  PIPELINE_STAGE_TO_STEP,
} from "./steps";
import { resolveSuggestedAction } from "./next-actions";
import type {
  ContactJourney,
  JourneyActionContext,
  JourneyEventRef,
  JourneyPhase,
  JourneySource,
  JourneyStepCode,
  JourneyTimelineEntry,
} from "./types";

export type PipelineLeadInput = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  stage: string;
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
};

export type PatientJourneyInput = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  updated_at: string;
  appointment?: {
    id: string;
    status: string;
    scheduled_at: string;
    is_return?: boolean;
  } | null;
  pendingFormCount: number;
  respondedFormCount: number;
};

function inferLeadSource(lead: PipelineLeadInput): JourneySource {
  if (lead.hasPublicForm) return "form";
  return "manual";
}

function resolveLeadStep(lead: PipelineLeadInput, pendingEvents: JourneyEventRef[]): JourneyStepCode {
  const hasPublicFormPending = pendingEvents.some(
    (e) => e.event_code === "public_form_completed" && !e.patient_id
  );
  if (hasPublicFormPending) return "cadastro_pendente";
  return PIPELINE_STAGE_TO_STEP[lead.stage] ?? "primeiro_contato";
}

function resolvePatientStep(patient: PatientJourneyInput, pendingEvents: JourneyEventRef[]): JourneyStepCode {
  const appt = patient.appointment;
  const hasReturnPending = pendingEvents.some((e) => e.event_code === "appointment_completed");

  if (hasReturnPending && appt?.status === "realizada") {
    return "retorno_sugerido";
  }

  if (appt?.is_return && ["agendada", "confirmada"].includes(appt.status)) {
    return "retorno_agendado";
  }

  if (appt) {
    if (patient.pendingFormCount > 0 && ["agendada", "confirmada"].includes(appt.status)) {
      if (appt.status === "confirmada") return "formulario_pendente";
      return APPOINTMENT_STATUS_TO_STEP[appt.status] ?? "consulta_agendada";
    }
    if (patient.respondedFormCount > 0 && ["agendada", "confirmada"].includes(appt.status)) {
      return appt.status === "confirmada" ? "formulario_ok" : "consulta_agendada";
    }
    return APPOINTMENT_STATUS_TO_STEP[appt.status] ?? "cadastrado";
  }

  return "cadastrado";
}

function buildTimelineFromHistory(
  history: PipelineLeadInput["history"],
  events: JourneyEventRef[]
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

  return entries.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
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
    currentStep,
    completedSteps,
    phase,
    pendingEvents,
    suggestedAction,
    timeline: buildTimelineFromHistory(lead.history, pendingEvents),
    updatedAt: lead.updated_at,
  };
}

export function buildPatientJourney(
  patient: PatientJourneyInput,
  pendingEvents: JourneyEventRef[],
  context: JourneyActionContext,
  source: JourneySource = "manual"
): ContactJourney {
  const currentStep = resolvePatientStep(patient, pendingEvents);
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
    currentStep,
    completedSteps,
    phase,
    pendingEvents,
    suggestedAction,
    appointmentId: patient.appointment?.id,
    appointmentStatus: patient.appointment?.status ?? null,
    appointmentScheduledAt: patient.appointment?.scheduled_at ?? null,
    timeline: buildTimelineFromHistory([], pendingEvents),
    updatedAt: patient.updated_at,
  };
}

export function filterJourneys(
  journeys: ContactJourney[],
  filters?: { phase?: JourneyPhase; source?: JourneySource; withPendingAction?: boolean }
): ContactJourney[] {
  return journeys.filter((j) => {
    if (filters?.phase && j.phase !== filters.phase) return false;
    if (filters?.source && j.source !== filters.source) return false;
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
    `Etapa atual: ${step.label} (${journey.phase})`,
    `Origem: ${journey.source}`,
    `Próxima ação sugerida: ${action}`,
    journey.pendingEvents.length > 0
      ? `Eventos pendentes: ${journey.pendingEvents.map((e) => e.event_name).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}
