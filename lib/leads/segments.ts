import type { PipelineItem } from "@/app/dashboard/pipeline/actions";

export type LeadHubSegment =
  | "captacao"
  | "nao_fechou"
  | "pendente_retorno"
  | "concluido"
  | "repescagem";

export const LEAD_SEGMENT_LABELS: Record<LeadHubSegment, string> = {
  captacao: "Captação",
  nao_fechou: "Não fechou",
  pendente_retorno: "Pendente retorno",
  concluido: "Concluídos",
  repescagem: "Repescagem",
};

export function derivePipelineSegment(item: PipelineItem): LeadHubSegment {
  const manual = item.lead_segment;
  if (
    manual === "captacao" ||
    manual === "nao_fechou" ||
    manual === "pendente_retorno" ||
    manual === "concluido"
  ) {
    return manual;
  }
  if (item.stage === "novo_contato") return "captacao";
  if (item.stage === "aguardando_retorno") {
    return item.next_action?.trim() ? "pendente_retorno" : "nao_fechou";
  }
  if (item.stage === "cadastrado" || item.stage === "agendado") return "concluido";
  return "captacao";
}

export function filterPipelineBySegment(
  items: PipelineItem[],
  segment: LeadHubSegment
): PipelineItem[] {
  if (segment === "repescagem") return [];
  return items.filter((item) => derivePipelineSegment(item) === segment);
}
