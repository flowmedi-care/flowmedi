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

/** Intent for how the list is presented to the patient. */
export type AppointmentListRenderMode = "browse" | "select" | "summary";

export type RenderAppointmentListInput = {
  appointments: AppointmentListItem[];
  locale?: string;
  timezone?: string;
  mode?: AppointmentListRenderMode;
};

export type MutationSuccessAction = "reschedule" | "cancel" | "create";

export type MutationSuccessData = {
  action: MutationSuccessAction;
  whenLabel?: string;
  doctorName?: string;
  procedureName?: string;
};

export function formatWhenLabel(
  iso: string,
  locale = "pt-BR",
  timezone = "America/Sao_Paulo"
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

function formatAppointmentWhen(
  iso: string,
  locale: string,
  timezone: string
): string {
  return formatWhenLabel(iso, locale, timezone);
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

function numberedLines(
  appointments: AppointmentListItem[],
  locale: string,
  timezone: string
): string[] {
  return appointments.map(
    (a, i) => `${i + 1}. ${formatOneLine(a, locale, timezone)}`
  );
}

/**
 * Deterministic projection of appointments[] → patient-visible text.
 * Order is array order: appointments[i] ↔ option i+1.
 *
 * Modes:
 * - browse: list only
 * - select: list + ask which number (Current Operation Selecting)
 * - summary: remaining after a cancel, no forced selection
 */
export function renderAppointmentList(
  input: RenderAppointmentListInput
): RenderedMessage {
  const locale = input.locale ?? "pt-BR";
  const timezone = input.timezone ?? "America/Sao_Paulo";
  const mode: AppointmentListRenderMode = input.mode ?? "browse";
  const appointments = input.appointments ?? [];

  if (appointments.length === 0) {
    return {
      text: "Não encontrei consultas agendadas ou confirmadas no momento.",
    };
  }

  const lines = numberedLines(appointments, locale, timezone);

  if (appointments.length === 1) {
    if (mode === "summary") {
      return { text: `Resta 1 consulta:\n${lines[0]}` };
    }
    if (mode === "select") {
      return {
        text: `Você tem 1 consulta:\n${lines[0]}\n\nConfirma que é essa? Responda com 1.`,
      };
    }
    return {
      text: `Você tem 1 consulta:\n${lines[0]}`,
    };
  }

  const header =
    mode === "summary"
      ? `Restam ${appointments.length} consultas:`
      : `Você tem ${appointments.length} consultas:`;

  if (mode === "select") {
    return {
      text:
        `${header}\n` +
        lines.join("\n") +
        `\n\nQual delas? Responda com o número (1 a ${appointments.length}).`,
    };
  }

  return {
    text: `${header}\n` + lines.join("\n"),
  };
}

export function renderMutationSuccess(
  data: MutationSuccessData
): RenderedMessage {
  const when = data.whenLabel?.trim();
  const proc = data.procedureName?.trim();
  const doctor = data.doctorName?.trim();
  const what =
    proc && doctor ? `${proc} com ${doctor}` : proc || doctor || "consulta";

  switch (data.action) {
    case "reschedule":
      return {
        text: when
          ? `Sua consulta foi remarcada com sucesso para ${when}.`
          : "Sua consulta foi remarcada com sucesso.",
      };
    case "cancel":
      return {
        text: when
          ? `Sua consulta (${what} — ${when}) foi cancelada com sucesso.`
          : `Sua ${what} foi cancelada com sucesso.`,
      };
    case "create":
      return {
        text: when
          ? `Sua consulta foi agendada com sucesso para ${when}.`
          : "Sua consulta foi agendada com sucesso.",
      };
    default:
      return { text: "Operação concluída com sucesso." };
  }
}

export type StructuredRenderStrategy = "appointment_list" | "mutation_success";

type ToolResultLike = {
  renderStrategy?: string;
  renderMode?: string;
  data?: unknown;
};

type StrategyFn = (
  result: ToolResultLike,
  opts: { locale: string; timezone: string }
) => RenderedMessage | null;

function resolveListMode(result: ToolResultLike): AppointmentListRenderMode {
  const fromExtras = result.renderMode;
  const data = result.data as { renderMode?: string } | undefined;
  const raw = fromExtras ?? data?.renderMode;
  if (raw === "select" || raw === "summary" || raw === "browse") return raw;
  return "browse";
}

/** Light strategy map — add slots/doctors later without tool-name branching. */
const STRUCTURED_RENDERERS: Record<string, StrategyFn> = {
  appointment_list: (result, opts) => {
    const data = result.data as { appointments?: AppointmentListItem[] } | undefined;
    const appointments = Array.isArray(data?.appointments) ? data!.appointments! : [];
    return renderAppointmentList({
      appointments,
      locale: opts.locale,
      timezone: opts.timezone,
      mode: resolveListMode(result),
    });
  },
  mutation_success: (result) => {
    const data = result.data as MutationSuccessData | undefined;
    if (!data?.action) return null;
    return renderMutationSuccess(data);
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
