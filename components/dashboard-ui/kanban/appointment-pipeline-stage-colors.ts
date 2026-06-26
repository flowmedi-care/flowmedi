import type { BadgeProps } from "@/components/ui/badge";
import type { AppointmentPipelineStatus } from "@/app/dashboard/crm/pipeline-actions";

export const APPOINTMENT_PIPELINE_STAGE_LABELS: Record<AppointmentPipelineStatus, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  falta: "Falta",
  cancelada: "Cancelada",
};

export const APPOINTMENT_PIPELINE_STAGE_BADGE_VARIANT: Record<
  AppointmentPipelineStatus,
  NonNullable<BadgeProps["variant"]>
> = {
  agendada: "info",
  confirmada: "success",
  realizada: "secondary",
  falta: "warning",
  cancelada: "destructive",
};

export const APPOINTMENT_PIPELINE_STAGE_ACCENT: Record<AppointmentPipelineStatus, string> = {
  agendada: "bg-info",
  confirmada: "bg-success",
  realizada: "bg-primary",
  falta: "bg-warning",
  cancelada: "bg-destructive",
};

export const APPOINTMENT_PIPELINE_STAGES: AppointmentPipelineStatus[] = [
  "agendada",
  "confirmada",
  "realizada",
  "falta",
  "cancelada",
];
