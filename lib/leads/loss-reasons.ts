export const LOSS_REASONS = [
  { value: "preco", label: "Valor / preço" },
  { value: "horario", label: "Horário / disponibilidade" },
  { value: "distancia", label: "Localização" },
  { value: "indecisao", label: "Indecisão / pesquisando" },
  { value: "urgencia_resolvida", label: "Urgência resolvida em outro lugar" },
  { value: "nao_respondeu", label: "Sem resposta" },
  { value: "motivo_nao_identificado", label: "Motivo não identificado" },
  { value: "desistiu", label: "Desistiu" },
  { value: "concorrencia", label: "Concorrência" },
  { value: "faltou_consulta", label: "Faltou à consulta" },
  { value: "cancelou_consulta", label: "Cancelou consulta" },
  { value: "outro", label: "Outro" },
] as const;

export type LossReasonValue = (typeof LOSS_REASONS)[number]["value"];

export const LOSS_REASON_LABELS: Record<string, string> = Object.fromEntries(
  LOSS_REASONS.map((r) => [r.value, r.label])
);

export function lossReasonLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return LOSS_REASON_LABELS[value] ?? value;
}
