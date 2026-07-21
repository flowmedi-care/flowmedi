import type { KnowledgeAcl } from "../knowledge-acl";
import type { FinanceActions } from "../finance-actions";

export type RuntimeCapabilityId =
  | "booking"
  | "cancel"
  | "reschedule"
  | "check_in"
  | "clinic_information"
  | "procedure_information"
  | "service_information"
  | "knowledge_base"
  | "pricing"
  | "quote"
  | "handoff"
  | "patient_lookup";

export type RuntimeCapabilityDef = {
  id: RuntimeCapabilityId;
  requiredTools: string[];
  requiredPrompt?: string;
  requiredSources: Array<"clinic" | "procedures" | "services" | "knowledge_base">;
  /** Partial context paths, e.g. clinic.hours */
  requiredContext: string[];
};

export const RUNTIME_CAPABILITY_DEFS: Record<RuntimeCapabilityId, RuntimeCapabilityDef> = {
  booking: {
    id: "booking",
    requiredTools: [
      "list_doctors",
      "list_procedures",
      "find_available_slots",
      "create_appointment",
    ],
    requiredSources: ["procedures"],
    requiredContext: ["clinic.hours", "clinic.units"],
    requiredPrompt: "Você pode agendar consultas quando os dados necessários estiverem coletados.",
  },
  cancel: {
    id: "cancel",
    requiredTools: ["list_patient_appointments", "cancel_appointment"],
    requiredSources: [],
    requiredContext: [],
  },
  reschedule: {
    id: "reschedule",
    requiredTools: ["list_patient_appointments", "find_available_slots", "reschedule_appointment"],
    requiredSources: ["procedures"],
    requiredContext: ["clinic.hours"],
  },
  check_in: {
    id: "check_in",
    requiredTools: ["perform_check_in"],
    requiredSources: [],
    requiredContext: [],
  },
  clinic_information: {
    id: "clinic_information",
    requiredTools: [],
    requiredSources: ["clinic"],
    requiredContext: [],
  },
  procedure_information: {
    id: "procedure_information",
    requiredTools: ["list_procedures", "get_procedure_info"],
    requiredSources: ["procedures"],
    requiredContext: [],
  },
  service_information: {
    id: "service_information",
    requiredTools: [],
    requiredSources: ["services"],
    requiredContext: [],
  },
  knowledge_base: {
    id: "knowledge_base",
    requiredTools: ["search_faq"],
    requiredSources: ["knowledge_base"],
    requiredContext: [],
  },
  pricing: {
    id: "pricing",
    requiredTools: ["get_service_price"],
    requiredSources: ["services"],
    requiredContext: [],
    requiredPrompt:
      "Preços: use get_service_price. FOUND → informe o valor/faixa. PARTIAL → pergunte o dado faltante (médico, particular/convênio). NOT_CONFIGURED → ofereça transfer_to_human no WhatsApp (paciente já está falando com a clínica; nunca peça telefone/e-mail). Nunca invente motivos de variação de preço.",
  },
  quote: {
    id: "quote",
    requiredTools: [],
    requiredSources: ["services", "procedures"],
    requiredContext: [],
  },
  handoff: {
    id: "handoff",
    requiredTools: ["transfer_to_human"],
    requiredSources: [],
    requiredContext: [],
  },
  patient_lookup: {
    id: "patient_lookup",
    requiredTools: ["lookup_patient_by_phone", "register_patient"],
    requiredSources: [],
    requiredContext: [],
  },
};

export type ResolvedCapabilities = {
  enabled: Set<RuntimeCapabilityId>;
};

export type CapabilityResolveInput = {
  knowledgeAcl: KnowledgeAcl;
  financeActions: FinanceActions;
  /** Attendance workflow enables */
  allowBooking: boolean;
  allowCancel: boolean;
  allowReschedule: boolean;
  checkInEnabled: boolean;
  humanHandoffEnabled: boolean;
};

/**
 * Resolve which runtime capabilities are active for this turn.
 * `pricing` requires service_information + services.showPrices.
 */
export function resolveEnabledCapabilities(input: CapabilityResolveInput): ResolvedCapabilities {
  const enabled = new Set<RuntimeCapabilityId>();

  if (input.allowBooking) enabled.add("booking");
  if (input.allowCancel) enabled.add("cancel");
  if (input.allowReschedule) enabled.add("reschedule");
  if (input.checkInEnabled) enabled.add("check_in");
  if (input.humanHandoffEnabled) enabled.add("handoff");
  enabled.add("patient_lookup");

  if (input.knowledgeAcl.clinic.enabled) enabled.add("clinic_information");
  if (input.knowledgeAcl.procedures.enabled) enabled.add("procedure_information");
  if (input.knowledgeAcl.services.enabled) enabled.add("service_information");
  if (input.knowledgeAcl.knowledge_base.enabled) enabled.add("knowledge_base");

  if (
    enabled.has("service_information") &&
    input.knowledgeAcl.services.fields.showPrices
  ) {
    enabled.add("pricing");
  }

  if (
    input.financeActions.allowGenerateQuote ||
    input.financeActions.allowSendQuote ||
    input.financeActions.allowCalculateQuote
  ) {
    enabled.add("quote");
  }

  return { enabled };
}

export function isCapabilityEnabled(
  resolved: ResolvedCapabilities,
  id: RuntimeCapabilityId
): boolean {
  return resolved.enabled.has(id);
}
