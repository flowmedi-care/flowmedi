import { buildAgentPolicyBlock } from "../agent-policy";
import type { AiConversationState, VirtualAssistantSettings } from "../types";
import { formatAiStateForPrompt } from "../format-ai-state";
import { buildPromptCore } from "./prompt-core";
import { buildPromptPersonality } from "./prompt-personality";
import { buildPromptTools } from "./prompt-tools";
import { buildPromptDecision, type PromptFlow } from "./prompt-decision";
import { buildPromptNegatives } from "./prompt-negatives";
import { buildPromptExamples } from "./prompt-examples";

export type ComposeSystemPromptOpts = {
  clinicName: string;
  assistantName: string;
  settings: Partial<VirtualAssistantSettings>;
  clinicData: string;
  flow: PromptFlow;
  aiState: AiConversationState;
  journeyBlock?: string;
  resumeHint?: string;
  whatsappPhone?: string;
  patientBootstrap?: string;
  pipelineBlock?: string;
};

export function resolvePromptFlow(aiState: AiConversationState, intent?: string): PromptFlow {
  const i = intent ?? aiState.intent;
  if (i === "booking" || aiState.booking_step) return "booking";
  if (i === "pricing" || i === "price") return "pricing";
  if (i === "my_appointments" || i === "appointments" || i === "cancel") return "appointments";
  return "general";
}

export function composeSystemPrompt(opts: ComposeSystemPromptOpts): string {
  const parts = [
    buildPromptCore({
      clinicName: opts.clinicName,
      assistantName: opts.assistantName,
      settings: opts.settings,
    }),
    buildPromptPersonality(opts.settings),
    buildAgentPolicyBlock(),
    buildPromptNegatives(),
    buildPromptDecision(opts.flow),
    buildPromptTools(opts.flow),
    buildPromptExamples(opts.flow),
  ];

  if (opts.whatsappPhone) {
    parts.push(
      `# Contexto WhatsApp\nTelefone do paciente nesta conversa: ${opts.whatsappPhone}\nJÁ DISPONÍVEL — NUNCA peça telefone ao paciente.`
    );
  }

  if (opts.patientBootstrap) {
    parts.push(`# Paciente\n${opts.patientBootstrap}`);
  }

  parts.push(opts.clinicData);

  if (opts.journeyBlock) parts.push(opts.journeyBlock);
  if (opts.resumeHint) parts.push(opts.resumeHint);
  if (opts.pipelineBlock) parts.push(`# Pipeline\n${opts.pipelineBlock}`);

  parts.push(`# Estado da conversa\n${formatAiStateForPrompt(opts.aiState)}`);

  return parts.filter(Boolean).join("\n\n");
}
