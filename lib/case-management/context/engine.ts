import type { CasePhase, JourneyCase } from "../types";
import { PHASE_DEFAULT_OBJECTIVE } from "../types";
import type { AIPolicyConfig } from "../policies";
import { resolveAIPolicy } from "../policies";

export type WorkspacePanel =
  | "chat"
  | "lead"
  | "tasks"
  | "timeline"
  | "agenda"
  | "anamnese"
  | "prontuario"
  | "financeiro"
  | "formularios"
  | "ia";

export type WorkspaceContext = {
  caseId: string;
  phase: CasePhase;
  journeyType: string;
  primaryPanels: WorkspacePanel[];
  secondaryPanels: WorkspacePanel[];
  priorityActions: string[];
  aiAllowedTools: string[];
  derivedObjective: string;
};

const PHASE_PANELS: Record<
  CasePhase,
  { primary: WorkspacePanel[]; secondary: WorkspacePanel[]; actions: string[] }
> = {
  captacao: {
    primary: ["chat", "lead", "tasks", "timeline"],
    secondary: ["formularios", "ia"],
    actions: ["Qualificar lead", "Enviar informações"],
  },
  comercial: {
    primary: ["chat", "lead", "tasks", "timeline"],
    secondary: ["agenda", "formularios", "ia"],
    actions: ["Enviar orçamento", "Agendar consulta"],
  },
  consulta: {
    primary: ["agenda", "anamnese", "prontuario", "timeline"],
    secondary: ["chat", "tasks", "formularios"],
    actions: ["Confirmar presença", "Check-in", "Registrar comparecimento"],
  },
  financeiro: {
    primary: ["financeiro", "tasks", "timeline"],
    secondary: ["chat", "agenda"],
    actions: ["Cobrar", "Registrar pagamento"],
  },
  pos: {
    primary: ["chat", "tasks", "timeline", "formularios"],
    secondary: ["agenda", "financeiro"],
    actions: ["Marcar retorno", "Enviar NPS"],
  },
  reengajamento: {
    primary: ["chat", "lead", "tasks", "timeline"],
    secondary: ["ia", "formularios"],
    actions: ["Reativar contato", "Oferecer retorno"],
  },
  perdido: {
    primary: ["timeline", "lead"],
    secondary: ["chat"],
    actions: ["Reabrir case"],
  },
  fechado: {
    primary: ["timeline"],
    secondary: ["chat"],
    actions: [],
  },
};

const PHASE_AI_TOOLS: Partial<Record<CasePhase, string[]>> = {
  captacao: [
    "lookup_patient_by_phone",
    "get_contact_journey",
    "publish_domain_event",
    "list_services",
  ],
  comercial: [
    "get_contact_journey",
    "publish_domain_event",
    "list_price_options",
    "create_quote",
  ],
  consulta: [
    "get_contact_journey",
    "list_available_slots",
    "confirm_appointment",
    "publish_domain_event",
  ],
  financeiro: ["get_contact_journey"],
  pos: ["get_contact_journey", "publish_domain_event"],
  reengajamento: ["get_contact_journey", "publish_domain_event", "list_services"],
};

/**
 * Context Engine — centraliza UX/IA do Workspace a partir do Case.
 * Não persiste estado de negócio.
 */
export function buildWorkspaceContext(
  journeyCase: JourneyCase,
  aiPolicy?: Partial<AIPolicyConfig> | null
): WorkspaceContext {
  const layout = PHASE_PANELS[journeyCase.phase] ?? PHASE_PANELS.captacao;
  const policy = resolveAIPolicy(aiPolicy);
  let tools = PHASE_AI_TOOLS[journeyCase.phase] ?? ["get_contact_journey"];

  if (!policy.canQualify) {
    tools = tools.filter((t) => t !== "publish_domain_event");
  }

  return {
    caseId: journeyCase.id,
    phase: journeyCase.phase,
    journeyType: journeyCase.journey_type,
    primaryPanels: layout.primary,
    secondaryPanels: layout.secondary,
    priorityActions: layout.actions,
    aiAllowedTools: tools,
    derivedObjective: PHASE_DEFAULT_OBJECTIVE[journeyCase.phase],
  };
}
