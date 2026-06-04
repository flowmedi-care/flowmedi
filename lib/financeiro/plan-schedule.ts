export type PlanScheduleFrequency = "semanal" | "quinzenal" | "mensal" | "manual";

/** Gera ISO datetimes para N sessões a partir da primeira data + horário. */
export function buildPlanSessionDates(
  firstDate: string,
  time: string,
  count: number,
  frequency: Exclude<PlanScheduleFrequency, "manual">
): string[] {
  if (count <= 0) return [];
  const [hh, mm] = time.split(":").map((v) => parseInt(v, 10) || 0);
  const start = new Date(firstDate + "T12:00:00");
  start.setHours(hh, mm, 0, 0);

  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    if (frequency === "semanal") {
      d.setDate(d.getDate() + i * 7);
    } else if (frequency === "quinzenal") {
      d.setDate(d.getDate() + i * 14);
    } else {
      d.setMonth(d.getMonth() + i);
    }
    dates.push(d.toISOString());
  }
  return dates;
}

export function mapPlanPolicyToAppointment(
  planPolicy: string | null
): "antecipado" | "no_dia" | "pos_atendimento" {
  switch (planPolicy) {
    case "parcelado":
      return "no_dia";
    case "por_sessao":
      return "pos_atendimento";
    default:
      return "antecipado";
  }
}
