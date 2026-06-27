import type { ComandaStatus } from "./types";

export const COMANDA_STATUS_LABELS: Record<ComandaStatus, string> = {
  aberta: "Aberta",
  parcial: "Parcial",
  paga: "Paga",
  cancelada: "Cancelada",
};

export const COMANDA_STATUS_VARIANTS: Record<
  ComandaStatus,
  "warning" | "info" | "success" | "destructive" | "secondary"
> = {
  aberta: "warning",
  parcial: "info",
  paga: "success",
  cancelada: "destructive",
};

export function getComandaStatusLabel(status: string): string {
  return COMANDA_STATUS_LABELS[status as ComandaStatus] ?? status;
}

export function getComandaStatusVariant(
  status: string
): "warning" | "info" | "success" | "destructive" | "secondary" {
  return COMANDA_STATUS_VARIANTS[status as ComandaStatus] ?? "secondary";
}
