/** Contextos em que um form template pode ser disparado (desacoplado do template). */
export const FORM_ALLOWED_CONTEXTS = [
  "captacao",
  "comercial",
  "pre_consulta",
  "pos_consulta",
  "retorno",
  "cirurgia",
  "financeiro",
  "feedback",
] as const;

export type FormAllowedContext = (typeof FORM_ALLOWED_CONTEXTS)[number];

export const FORM_CONTEXT_LABELS: Record<FormAllowedContext, string> = {
  captacao: "Captação",
  comercial: "Comercial",
  pre_consulta: "Pré-consulta",
  pos_consulta: "Pós-consulta",
  retorno: "Retorno",
  cirurgia: "Cirurgia",
  financeiro: "Financeiro",
  feedback: "Feedback / NPS",
};

export function normalizeAllowedContexts(
  raw: unknown
): FormAllowedContext[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(FORM_ALLOWED_CONTEXTS);
  return raw.filter((c): c is FormAllowedContext => set.has(c as FormAllowedContext));
}
