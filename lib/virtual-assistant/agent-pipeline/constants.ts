/** Ferramentas que alteram dados — filtradas estritamente por etapa. */
export const MUTATING_TOOL_NAMES = [
  "register_patient",
  "create_appointment",
  "confirm_appointment",
  "cancel_appointment",
  "reschedule_appointment",
  "create_and_send_quote",
  "resend_form_link",
  "collect_nps_feedback",
  "transfer_to_human",
] as const;

export type MutatingToolName = (typeof MUTATING_TOOL_NAMES)[number];

/** Sempre disponível (transversal). */
export const TRANSVERSAL_TOOL_NAMES = ["transfer_to_human"] as const;

/** Etapas CRM em que create_and_send_quote é human_only. */
export const HUMAN_ONLY_QUOTE_STEPS = new Set([
  "orcamento_rascunho",
  "orcamento_aceito",
]);

/** Máximo de falhas consecutivas antes de escalar. */
export const MAX_CONSECUTIVE_TOOL_FAILURES = 3;
