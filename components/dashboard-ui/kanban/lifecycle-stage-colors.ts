import type { BadgeProps } from "@/components/ui/badge";
import type { LifecycleStage } from "@/lib/leads/lifecycle";

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  lead_novo: "Lead novo",
  em_qualificacao: "Em qualificação",
  qualificado: "Qualificado",
  oportunidade: "Oportunidade",
  cliente: "Cliente",
  perdido: "Perdido",
};

export const LIFECYCLE_STAGE_BADGE_VARIANT: Record<
  LifecycleStage,
  NonNullable<BadgeProps["variant"]>
> = {
  lead_novo: "info",
  em_qualificacao: "warning",
  qualificado: "secondary",
  oportunidade: "default",
  cliente: "success",
  perdido: "destructive",
};

export const LIFECYCLE_STAGE_ACCENT: Record<LifecycleStage, string> = {
  lead_novo: "bg-info",
  em_qualificacao: "bg-warning",
  qualificado: "bg-primary",
  oportunidade: "bg-accent",
  cliente: "bg-success",
  perdido: "bg-destructive",
};
