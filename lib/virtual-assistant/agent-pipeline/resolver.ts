import type { ContactJourney } from "@/lib/contact-journey/types";
import type { InboundIntent } from "../detect-inbound-intent";
import type { PromptFlow } from "../prompt/prompt-decision";
import type { AiConversationState } from "../types";
import { type AgentPipelineStage } from "./stages";
import {
  deriveRuntimeStage,
  type DeriveRuntimeStageInput,
} from "../conversation-state/derive-runtime-stage";

export type ResolvePipelineStageInput = DeriveRuntimeStageInput & {
  journey: ContactJourney | null;
  routedFlow: PromptFlow;
};

export function resolveAgentPipelineStage(input: ResolvePipelineStageInput): AgentPipelineStage {
  return deriveRuntimeStage(input);
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
