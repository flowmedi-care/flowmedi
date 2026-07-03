import type { ContactJourney } from "@/lib/contact-journey/types";
import type { InboundIntent } from "../detect-inbound-intent";
import type { PromptFlow } from "../prompt/prompt-decision";
import type { AiConversationState } from "../types";
import {
  type AgentPipelineStage,
  AGENT_PIPELINE_STAGE_MAP,
  JOURNEY_STEP_TO_PIPELINE_STAGE,
} from "./stages";

export type ResolvePipelineStageInput = {
  aiState: AiConversationState;
  journey: ContactJourney | null;
  detectedIntent: InboundIntent;
  routedFlow: PromptFlow;
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

export function resolveAgentPipelineStage(input: ResolvePipelineStageInput): AgentPipelineStage {
  const { aiState, journey, detectedIntent, routedFlow } = input;

  if (aiState.pipeline_stage && AGENT_PIPELINE_STAGE_MAP.has(aiState.pipeline_stage)) {
    const persisted = aiState.pipeline_stage;
    if (persisted === "agendamento" && aiState.booking_step === "done") {
      return "confirmacao_pre_consulta";
    }
    if (persisted !== "identificacao" || !journey) {
      return persisted;
    }
  }

  if (aiState.pending_confirmation_appointment_id || aiState.pending_reschedule_appointment_id) {
    return "confirmacao_pre_consulta";
  }

  if (aiState.booking_step && aiState.booking_step !== "done") {
    return "agendamento";
  }

  if (aiState.last_created_appointment_id && !aiState.booking_step) {
    return "confirmacao_pre_consulta";
  }

  const journeyStep = journey?.currentStep ?? aiState.journey_step_code;

  if (journeyStep) {
    if (SATISFACAO_STEPS.has(journeyStep)) return "satisfacao";
    if (FORMULARIO_STEPS.has(journeyStep)) return "formularios";
    if (FINANCEIRO_STEPS.has(journeyStep)) return "financeiro";
    if (POS_CONSULTA_STEPS.has(journeyStep)) return "pos_consulta";
    if (PRE_CONSULTA_STEPS.has(journeyStep)) return "confirmacao_pre_consulta";
    if (ORCAMENTO_STEPS.has(journeyStep)) return "orcamento";
    const mapped = JOURNEY_STEP_TO_PIPELINE_STAGE[journeyStep];
    if (mapped) return mapped;
  }

  if (detectedIntent === "payment" || aiState.intent === "payment") {
    return "financeiro";
  }
  if (detectedIntent === "form") {
    return "formularios";
  }
  if (detectedIntent === "booking" || detectedIntent === "reschedule" || routedFlow === "booking") {
    return "agendamento";
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

export function resolveParallelStages(
  mainStage: AgentPipelineStage,
  journey: ContactJourney | null,
  detectedIntent: InboundIntent
): AgentPipelineStage[] {
  const parallel: AgentPipelineStage[] = [];
  const step = journey?.currentStep;

  if (
    mainStage !== "financeiro" &&
    (detectedIntent === "payment" ||
      step === "pagamento_pendente" ||
      step === "pagamento_parcial" ||
      step === "pago")
  ) {
    parallel.push("financeiro");
  }

  if (
    mainStage !== "formularios" &&
    (step === "formulario_pendente" || detectedIntent === "form")
  ) {
    parallel.push("formularios");
  }

  return parallel;
}
