import type { JourneyStepCode } from "@/lib/contact-journey/types";

export type ConfirmationTouchpoint = "7d" | "2d" | "day";

export type ConfirmationPlan = {
  touchpoints: ConfirmationTouchpoint[];
  skipReason?: string;
};

/** Days until appointment from now (calendar days, floor). */
export function daysUntilAppointment(scheduledAt: string, now = new Date()): number {
  const appt = new Date(scheduledAt);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(appt.getFullYear(), appt.getMonth(), appt.getDate());
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Régua: 7d (leve) → 2d (formal) → dia (só confirmados).
 * Agendamento em cima da hora pula etapas conforme antecedência.
 */
export function planConfirmationTouchpoints(
  scheduledAt: string,
  now = new Date()
): ConfirmationPlan {
  const days = daysUntilAppointment(scheduledAt, now);

  if (days < 0) {
    return { touchpoints: [], skipReason: "Consulta no passado" };
  }

  if (days === 0) {
    return { touchpoints: ["day"], skipReason: "Agendamento no mesmo dia" };
  }

  if (days === 1) {
    return { touchpoints: ["2d", "day"], skipReason: "Agendamento para amanhã" };
  }

  if (days < 7) {
    return { touchpoints: ["2d", "day"], skipReason: "Menos de 7 dias de antecedência" };
  }

  return { touchpoints: ["7d", "2d", "day"] };
}

export function confirmationStepForTouchpoint(touch: ConfirmationTouchpoint): JourneyStepCode {
  switch (touch) {
    case "7d":
      return "compliance_7d_enviado";
    case "2d":
      return "compliance_2d_enviado";
    case "day":
      return "lembrete_dia_enviado";
  }
}

export function nextConfirmationTouchpoint(
  scheduledAt: string,
  completed: ConfirmationTouchpoint[],
  now = new Date()
): ConfirmationTouchpoint | null {
  const plan = planConfirmationTouchpoints(scheduledAt, now);
  const days = daysUntilAppointment(scheduledAt, now);

  for (const touch of plan.touchpoints) {
    if (completed.includes(touch)) continue;
    if (touch === "7d" && days > 7) continue;
    if (touch === "2d" && days > 2) continue;
    if (touch === "day" && days > 0) continue;
    return touch;
  }

  return null;
}
