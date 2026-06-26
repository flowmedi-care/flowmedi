import type { BadgeProps } from "@/components/ui/badge";

export const PIPELINE_STAGE_LABELS = {
  novo_contato: "Novo Contato",
  aguardando_retorno: "Aguardando Retorno",
  cadastrado: "Cadastrado",
  agendado: "Agendado",
} as const;

export type PipelineStageKey = keyof typeof PIPELINE_STAGE_LABELS;

export const PIPELINE_STAGE_BADGE_VARIANT: Record<
  PipelineStageKey,
  NonNullable<BadgeProps["variant"]>
> = {
  novo_contato: "info",
  aguardando_retorno: "warning",
  cadastrado: "secondary",
  agendado: "success",
};

export const PIPELINE_STAGE_ACCENT: Record<PipelineStageKey, string> = {
  novo_contato: "bg-info",
  aguardando_retorno: "bg-warning",
  cadastrado: "bg-primary",
  agendado: "bg-success",
};
