import type { ContactJourney } from "@/lib/contact-journey/types";
import type { InboundIntent } from "../detect-inbound-intent";
import { hasOfferedBookingSelection, isDormantBookingState } from "../booking-continuity-guards";
import type { PromptFlow } from "../prompt/prompt-decision";
import type { AiConversationState } from "../types";
import {
  applyPipelineStageTransition,
  type PipelineTransitionTrigger,
} from "../agent-pipeline/transitions";
import {
  type AgentPipelineStage,
  JOURNEY_STEP_TO_PIPELINE_STAGE,
} from "../agent-pipeline/stages";

export type DeriveRuntimeStageInput = {
  aiState: AiConversationState;
  journey?: ContactJourney | null;
  detectedIntent: InboundIntent;
  routedFlow?: PromptFlow;
  patientFound?: boolean;
};

const PRE_CONSULTA_STEPS = new Set([
  "consulta_agendada",
  "agradecimento_agendamento",
  "compliance_7d_enviado",
  "compliance_2d_enviado",
  "consulta_confirmada",
  "lembrete_dia_enviado",
  "reagendamento_confirmado",
  "formulario_ok",
]);

const ORCAMENTO_STEPS = new Set([
  "orcamento_rascunho",
  "orcamento_enviado",
  "orcamento_aceito",
  "orcamento_recusado",
  "orcamento_vencido",
  "negociacao",
]);

const POS_CONSULTA_STEPS = new Set([
  "consulta_realizada",
  "retorno_sugerido",
  "retorno_agendado",
  "consulta_falta",
]);

const FINANCEIRO_STEPS = new Set(["pagamento_pendente", "pagamento_parcial", "pago"]);

const FORMULARIO_STEPS = new Set(["formulario_pendente"]);

const SATISFACAO_STEPS = new Set(["pesquisa_nps_enviada", "feedback_recebido"]);

function mapJourneyStepToStage(journeyStep: string): AgentPipelineStage | null {
  if (SATISFACAO_STEPS.has(journeyStep)) return "satisfacao";
  if (FORMULARIO_STEPS.has(journeyStep)) return "formularios";
  if (FINANCEIRO_STEPS.has(journeyStep)) return "financeiro";
  if (POS_CONSULTA_STEPS.has(journeyStep)) return "pos_consulta";
  if (PRE_CONSULTA_STEPS.has(journeyStep)) return "confirmacao_pre_consulta";
  if (ORCAMENTO_STEPS.has(journeyStep)) return "orcamento";
  return JOURNEY_STEP_TO_PIPELINE_STAGE[journeyStep] ?? null;
}

/** Fonte única para etapa operacional — nunca usa pipeline_stage persistido como override. */
export function deriveRuntimeStage(input: DeriveRuntimeStageInput): AgentPipelineStage {
  const { aiState, journey, detectedIntent, routedFlow } = input;

  if (
    aiState.booking_step &&
    aiState.booking_step !== "done" &&
    !isDormantBookingState(aiState)
  ) {
    return "agendamento";
  }
  if (hasOfferedBookingSelection(aiState)) {
    return "agendamento";
  }

  if (aiState.pending_confirmation_appointment_id || aiState.pending_reschedule_appointment_id) {
    return "confirmacao_pre_consulta";
  }

  const journeyStep = journey?.currentStep ?? aiState.journey_step_code;
  if (journeyStep) {
    const mapped = mapJourneyStepToStage(journeyStep);
    if (mapped) return mapped;
  }

  if (
    detectedIntent === "booking" ||
    detectedIntent === "availability_check" ||
    detectedIntent === "reschedule" ||
    routedFlow === "booking"
  ) {
    return "agendamento";
  }

  if (aiState.last_created_appointment_id && !aiState.booking_step) {
    return "confirmacao_pre_consulta";
  }

  if (detectedIntent === "payment" || aiState.intent === "payment") {
    return "financeiro";
  }
  if (detectedIntent === "form") {
    return "formularios";
  }
  if (detectedIntent === "pricing" || detectedIntent === "quote" || routedFlow === "pricing") {
    return "orcamento";
  }
  if (
    detectedIntent === "my_appointments" ||
    detectedIntent === "cancel" ||
    routedFlow === "appointments"
  ) {
    return "confirmacao_pre_consulta";
  }

  if (!input.patientFound && input.patientFound !== undefined && !aiState.patient_id) {
    return "identificacao";
  }

  if (aiState.patient_id || journey?.contactType === "patient") {
    return "captacao";
  }

  return "identificacao";
}

/** Retorna patch de pipeline_stage apenas se o valor derivado mudou (cache UI + eventos). */
export function syncDerivedPipelineStage(
  aiState: AiConversationState,
  derivedStage: AgentPipelineStage,
  trigger: PipelineTransitionTrigger = "journey_step"
): Partial<AiConversationState> {
  return applyPipelineStageTransition(aiState, derivedStage, trigger);
}
