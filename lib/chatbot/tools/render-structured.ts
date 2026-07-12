/** Pure structured projections — no aiState, DB, or chat context. */

export type RenderedMessage = {
  text: string;
};

export type AppointmentListItem = {
  id: string;
  scheduled_at: string;
  status: string;
  doctor_name?: string | null;
  procedure_name?: string | null;
  valor?: number | null;
  patient_id?: string;
};

export type RenderAppointmentListInput = {
  appointments: AppointmentListItem[];
  locale?: string;
  timezone?: string;
};

function formatAppointmentWhen(
  iso: string,
  locale: string,
  timezone: string
): string {
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return iso;
    return dt.toLocaleString(locale, {
      timeZone: timezone,
      weekday: "long",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatOneLine(
  appt: AppointmentListItem,
  locale: string,
  timezone: string
): string {
  const when = formatAppointmentWhen(appt.scheduled_at, locale, timezone);
  const proc = appt.procedure_name?.trim() || "Consulta";
  const doctor = appt.doctor_name?.trim();
  const withDoctor = doctor ? `${proc} com ${doctor}` : proc;
  return `${withDoctor} — ${when}`;
}

/**
 * Deterministic projection of appointments[] → patient-visible text.
 * Order is array order: appointments[i] ↔ option i+1.
 */
export function renderAppointmentList(
  input: RenderAppointmentListInput
): RenderedMessage {
  const locale = input.locale ?? "pt-BR";
  const timezone = input.timezone ?? "America/Sao_Paulo";
  const appointments = input.appointments ?? [];

  if (appointments.length === 0) {
    return {
      text: "Não encontrei consultas agendadas ou confirmadas no momento.",
    };
  }

  if (appointments.length === 1) {
    const line = formatOneLine(appointments[0]!, locale, timezone);
    return {
      text: `Você tem 1 consulta:\n1. ${line}`,
    };
  }

  const lines = appointments.map(
    (a, i) => `${i + 1}. ${formatOneLine(a, locale, timezone)}`
  );
  return {
    text:
      `Você tem ${appointments.length} consultas:\n` +
      lines.join("\n") +
      `\n\nQual delas? Responda com o número (1 a ${appointments.length}).`,
  };
}

export type StructuredRenderStrategy = "appointment_list";

type ToolResultLike = {
  renderStrategy?: string;
  data?: unknown;
};

type StrategyFn = (
  result: ToolResultLike,
  opts: { locale: string; timezone: string }
) => RenderedMessage | null;

/** Light strategy map — add slots/doctors later without tool-name branching. */
const STRUCTURED_RENDERERS: Record<string, StrategyFn> = {
  appointment_list: (result, opts) => {
    const data = result.data as { appointments?: AppointmentListItem[] } | undefined;
    const appointments = Array.isArray(data?.appointments) ? data!.appointments! : [];
    return renderAppointmentList({
      appointments,
      locale: opts.locale,
      timezone: opts.timezone,
    });
  },
};

/**
 * Resolve patient-visible text from a structured tool result.
 * Returns null when no strategy is set or unknown.
 */
export function renderStructuredToolResult(
  result: ToolResultLike,
  opts?: { locale?: string; timezone?: string }
): RenderedMessage | null {
  const strategy = result.renderStrategy;
  if (!strategy) return null;
  const fn = STRUCTURED_RENDERERS[strategy];
  if (!fn) return null;
  return fn(result, {
    locale: opts?.locale ?? "pt-BR",
    timezone: opts?.timezone ?? "America/Sao_Paulo",
  });
}
