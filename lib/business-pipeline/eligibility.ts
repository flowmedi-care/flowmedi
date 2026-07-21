/**
 * Quem entra no forecast e quem é elegível para etapas do pipeline.
 * Desacoplado do modelo probabilístico.
 */

export type AppointmentForecastInput = {
  status: string;
  scheduled_at: string | null;
  valor: number | null;
  payment_policy?: string | null;
};

const ACTIVE_SCHEDULE_STATUSES = new Set(["agendada", "confirmada"]);
const TERMINAL_EXCLUDE = new Set(["cancelada", "falta"]);

/** Appointment entra na previsão de Agendado (ainda ativo na agenda). */
export function canForecastAppointment(a: AppointmentForecastInput): boolean {
  if (TERMINAL_EXCLUDE.has(a.status)) return false;
  if (!ACTIVE_SCHEDULE_STATUSES.has(a.status) && a.status !== "realizada") return false;
  return Number(a.valor ?? 0) > 0 || ACTIVE_SCHEDULE_STATUSES.has(a.status);
}

/** Ainda está na agenda ativa (não cancelada/falta). */
export function isActiveScheduleStatus(status: string): boolean {
  return ACTIVE_SCHEDULE_STATUSES.has(status);
}

/** Políticas que exigem cobrança antes / no dia. */
export function isEarlyPaymentPolicy(policy: string | null | undefined): boolean {
  return policy === "antecipado" || policy === "no_dia";
}

/** scheduled_at no passado ou hoje (fim do dia local). */
export function isDueOrToday(scheduledAt: string | null | undefined, todayDateOnly: string): boolean {
  if (!scheduledAt) return false;
  return scheduledAt.slice(0, 10) <= todayDateOnly;
}
