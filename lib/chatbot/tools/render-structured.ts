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

export type SlotListItem = {
  display: string;
  scheduled_at?: string;
};

export type RenderSlotListInput = {
  slots: SlotListItem[];
  /** Prefixed when the requested time was not in the list. */
  notFoundHour?: string;
};

/**
 * Authoritative patient-visible slot list — only display labels, never ISO.
 */
export function renderSlotList(input: RenderSlotListInput): RenderedMessage {
  const slots = input.slots ?? [];
  if (slots.length === 0) {
    return { text: "Não há horários disponíveis no momento." };
  }

  const lines = slots.map((s, i) => `${i + 1}. ${(s.display ?? "").trim() || "—"}`);
  const header = input.notFoundHour
    ? `Não encontrei o horário ${input.notFoundHour}. Escolha um dos disponíveis:`
    : "Horários disponíveis:";

  return {
    text:
      `${header}\n` +
      lines.join("\n") +
      `\n\nQual horário? Responda com o número ou o horário (ex.: ${slots[0]?.display ?? "10:00"}).`,
  };
}

/**
 * Prefer offered display for the clock; keep weekday/date from clinic-local ISO format.
 */
export function whenLabelFromOffered(
  scheduledAt: string,
  offeredSlots?: Array<{ scheduled_at: string; display: string }>,
  _dateLabel?: string
): string {
  const match = offeredSlots?.find((s) => s.scheduled_at === scheduledAt);
  const display = match?.display?.trim();
  const fromIso = formatWhenLabel(scheduledAt);
  if (display) {
    // Replace the local HH:MM in the formatted string with authoritative display.
    const replaced = fromIso.replace(/\d{1,2}:\d{2}/, display);
    if (replaced !== fromIso) return replaced;
    return `${fromIso.replace(/\d{1,2}:\d{2}.*$/, "").trim()} às ${display}`.replace(
      /\s+às\s+às\s+/i,
      " às "
    );
  }
  return fromIso;
}

/**
 * Slot confirmation line — requires pending_slot (never invent).
 */
export function renderSlotConfirmation(input: {
  pendingSlot?: string | null;
  offeredSlots?: Array<{ scheduled_at: string; display: string }>;
  askConfirm?: boolean;
}): RenderedMessage | null {
  const pending = input.pendingSlot?.trim();
  if (!pending) return null;
  const label = whenLabelFromOffered(pending, input.offeredSlots);
  const base = `Você escolheu o horário ${label} para a sua consulta.`;
  if (input.askConfirm === false) return { text: base };
  return {
    text: `${base}\n\nConfirma que deseja usar esse horário?`,
  };
}

export type StructuredRenderStrategy =
  | "appointment_list"
  | "mutation_success"
  | "slot_list";

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
  slot_list: (result) => {
    const data = result.data as {
      slots?: Array<{ display?: string; label?: string; scheduled_at?: string }>;
      notFoundHour?: string;
    } | undefined;
    const raw = Array.isArray(data?.slots) ? data!.slots! : [];
    const slots = raw.map((s) => ({
      display: (s.display ?? s.label ?? "").trim(),
      scheduled_at: s.scheduled_at,
    }));
    return renderSlotList({
      slots,
      notFoundHour: data?.notFoundHour,
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
