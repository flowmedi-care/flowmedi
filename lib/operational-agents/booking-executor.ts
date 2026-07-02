import type { SupabaseClient } from "@supabase/supabase-js";
import { findSlotsForDay, type SlotPeriod } from "@/lib/appointment-conflicts";
import type { AiConversationState, OfferedDay, OfferedSlot } from "@/lib/virtual-assistant/types";
import {
  bootstrapPatientForBooking,
  buildPostCreateReply,
} from "@/lib/virtual-assistant/booking-flow";
import { createAppointmentViaAssistant } from "@/lib/virtual-assistant/services/appointments";
import { logAgentRun } from "./agent-runs";

export type BookingExecutorResult =
  | { handled: true; reply: string; statePatch: Partial<AiConversationState> }
  | { handled: false };

const WEEKDAY_PATTERNS: { pattern: RegExp; dayIndex: number }[] = [
  { pattern: /\bdomingo\b|\bdom\.?\b/i, dayIndex: 0 },
  { pattern: /\bsegunda\b|\bseg\.?\b/i, dayIndex: 1 },
  { pattern: /\bter[cç]a\b|\bter\.?\b/i, dayIndex: 2 },
  { pattern: /\bquarta\b|\bqua\.?\b/i, dayIndex: 3 },
  { pattern: /\bquinta\b|\bqui\.?\b/i, dayIndex: 4 },
  { pattern: /\bsexta\b|\bsex\.?\b/i, dayIndex: 5 },
  { pattern: /\bs[aá]bado\b|\bsab\.?\b/i, dayIndex: 6 },
];

export function isActiveBookingState(state: AiConversationState): boolean {
  if (state.last_created_appointment_id) return false;
  if (state.intent === "booking" && state.booking_step && state.booking_step !== "done") {
    return true;
  }
  const hasOffered =
    (state.offered_slots?.length ?? 0) > 0 || (state.offered_days?.length ?? 0) > 0;
  const inLateStep =
    state.booking_step === "day" ||
    state.booking_step === "slot" ||
    state.booking_step === "confirm" ||
    state.booking_step === "patient";
  return hasOffered && inLateStep && Boolean(state.procedure_id && state.doctor_id);
}

function parsePeriod(text: string): SlotPeriod | null {
  const t = text.toLowerCase();
  if (/\bmanh[aã]\b/.test(t)) return "manha";
  if (/\btarde\b/.test(t)) return "tarde";
  if (/\bqualquer\s+hor[aá]rio\b/.test(t) && /\bmanh[aã]\b/.test(t)) return "manha";
  if (/\bqualquer\s+hor[aá]rio\b/.test(t) && /\btarde\b/.test(t)) return "tarde";
  return null;
}

function parseDateFromText(text: string): string | null {
  const dm = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    const year = dm[3] ? Number(dm[3]) : new Date().getFullYear();
    const y = year < 100 ? 2000 + year : year;
    const d = new Date(y, month - 1, day);
    if (!Number.isNaN(d.getTime())) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

function matchOfferedDay(text: string, offeredDays: OfferedDay[]): OfferedDay | null {
  const iso = parseDateFromText(text);
  if (iso) {
    const byDate = offeredDays.find((d) => d.date === iso);
    if (byDate) return byDate;
  }

  for (const { pattern, dayIndex } of WEEKDAY_PATTERNS) {
    if (!pattern.test(text)) continue;
    const match = offeredDays.find((d) => {
      const parsed = new Date(`${d.date}T12:00:00`);
      return parsed.getDay() === dayIndex;
    });
    if (match) return match;
  }

  const numbered = text.match(/\b(\d)\b/);
  if (numbered) {
    const idx = Number(numbered[1]) - 1;
    if (idx >= 0 && idx < offeredDays.length) return offeredDays[idx]!;
  }

  return null;
}

function matchOfferedSlot(text: string, slots: OfferedSlot[]): OfferedSlot | null {
  const numbered = text.match(/\b(\d{1,2})\b/);
  if (numbered) {
    const idx = Number(numbered[1]) - 1;
    if (idx >= 0 && idx < slots.length) return slots[idx]!;
  }

  const timeMatch = text.match(/\b(\d{1,2})[:\s]?(\d{2})?\b/);
  if (timeMatch) {
    const h = timeMatch[1]!.padStart(2, "0");
    const m = (timeMatch[2] ?? "00").padStart(2, "0");
    const needle = `${h}:${m}`;
    const found = slots.find(
      (s) => s.display.includes(needle) || s.scheduled_at.includes(`T${h}:${m}`)
    );
    if (found) return found;
  }

  return null;
}

function filterSlotsByPeriod(slots: OfferedSlot[], period: SlotPeriod | null): OfferedSlot[] {
  if (!period) return slots;
  return slots.filter((s) => {
    const hour = new Date(s.scheduled_at).getHours();
    return period === "manha" ? hour < 12 : hour >= 12;
  });
}

function isSlotSelectionMessage(text: string): boolean {
  const t = text.toLowerCase();
  if (WEEKDAY_PATTERNS.some((w) => w.pattern.test(t))) return true;
  if (/\bmanh[aã]\b|\btarde\b|\bqualquer\s+hor[aá]rio\b/.test(t)) return true;
  if (/\b(\d{1,2})\/(\d{1,2})\b/.test(t)) return true;
  if (/\bpode ser\b|\bprefiro\b|\bquero\b.*\b(sexta|segunda|ter[cç]a|quarta|quinta|s[aá]bado)\b/.test(t)) {
    return true;
  }
  if (/^\s*\d{1,2}\s*$/.test(t)) return true;
  return false;
}

export async function tryExecuteBookingSlotSelection(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    phoneNumber: string;
    messageText: string;
    aiState: AiConversationState;
  }
): Promise<BookingExecutorResult> {
  const text = opts.messageText.trim();
  if (!text || !isSlotSelectionMessage(text)) return { handled: false };

  const state = opts.aiState;
  if (!state.procedure_id || !state.doctor_id) return { handled: false };
  if (!isActiveBookingState(state) && state.intent !== "booking") return { handled: false };

  const offeredDays = state.offered_days ?? [];
  const offeredSlots = state.offered_slots ?? [];
  if (offeredDays.length === 0 && offeredSlots.length === 0) return { handled: false };

  const period = parsePeriod(text) ?? state.last_slot_query?.period ?? null;
  let selectedSlot = matchOfferedSlot(text, offeredSlots);
  let selectedDay = matchOfferedDay(text, offeredDays);

  if (!selectedSlot && selectedDay) {
    const slots = await findSlotsForDay(supabase, {
      clinicId: opts.clinicId,
      doctorId: state.doctor_id,
      procedureId: state.procedure_id,
      date: selectedDay.date,
      period: period ?? undefined,
      excludeAppointmentId: state.last_created_appointment_id ?? null,
      patientId: state.patient_id ?? null,
    });
    const mapped: OfferedSlot[] = slots.map((s) => ({
      scheduled_at: s.scheduled_at,
      display: s.label,
    }));
    const filtered = filterSlotsByPeriod(mapped, period);
    selectedSlot = filtered[0] ?? mapped[0] ?? null;
  }

  if (!selectedSlot && offeredSlots.length > 0) {
    const filtered = filterSlotsByPeriod(offeredSlots, period);
    selectedSlot = filtered[0] ?? null;
  }

  if (!selectedSlot) return { handled: false };

  let patientId = state.patient_id;
  if (!patientId) {
    const boot = await bootstrapPatientForBooking(supabase, {
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      phoneNumber: opts.phoneNumber,
      aiState: state,
    });
    patientId = boot.statePatch.patient_id;
    if (!patientId) {
      return {
        handled: true,
        reply: "Para confirmar o horário, preciso do seu nome completo.",
        statePatch: {
          ...boot.statePatch,
          intent: "booking",
          booking_step: "patient",
          offered_slots: offeredSlots.length ? offeredSlots : [selectedSlot],
          offered_days: offeredDays,
          last_slot_query: state.last_slot_query,
        },
      };
    }
  }

  const startedAt = Date.now();
  await logAgentRun(supabase, {
    clinicId: opts.clinicId,
    agentType: "booking",
    status: "running",
    conversationId: opts.conversationId,
    action: "create_appointment",
    detail: { scheduled_at: selectedSlot.scheduled_at, display: selectedSlot.display },
  });

  const res = await createAppointmentViaAssistant(supabase, {
    clinicId: opts.clinicId,
    patientId,
    doctorId: state.doctor_id,
    procedureId: state.procedure_id,
    scheduledAt: selectedSlot.scheduled_at,
    dimensionValueIds: state.dimension_value_ids ?? [],
    serviceId: state.service_id ?? null,
  });

  if (res.error || !res.appointmentId) {
    await logAgentRun(supabase, {
      clinicId: opts.clinicId,
      agentType: "booking",
      status: "failed",
      conversationId: opts.conversationId,
      action: "create_appointment",
      detail: { error: res.error },
      durationMs: Date.now() - startedAt,
    });
    return {
      handled: true,
      reply:
        res.error?.includes("sala") || res.error?.includes("Sala")
          ? "Este agendamento precisa de confirmação da equipe para escolher a sala. Vou chamar alguém para concluir."
          : `Não consegui reservar esse horário: ${res.error ?? "tente outro horário."}`,
      statePatch: {
        intent: "booking",
        booking_step: "slot",
        offered_slots: offeredSlots,
        offered_days: offeredDays,
      },
    };
  }

  const reply = await buildPostCreateReply(supabase, {
    clinicId: opts.clinicId,
    appointmentId: res.appointmentId,
    patientId,
  });

  await logAgentRun(supabase, {
    clinicId: opts.clinicId,
    agentType: "booking",
    status: "done",
    conversationId: opts.conversationId,
    action: "create_appointment",
    detail: { appointmentId: res.appointmentId },
    durationMs: Date.now() - startedAt,
  });

  return {
    handled: true,
    reply,
    statePatch: {
      intent: undefined,
      booking_step: "done",
      last_created_appointment_id: res.appointmentId,
      patient_id: patientId,
      pending_slot: undefined,
      offered_slots: undefined,
      offered_days: undefined,
      last_slot_query: undefined,
    },
  };
}

export function buildOfferedStateFromSlotsTool(
  mode: "times" | "days",
  payload: {
    date?: string;
    period?: SlotPeriod | null;
    slots?: Array<{ scheduled_at: string; label: string }>;
    days?: Array<{ date: string; label: string }>;
  },
  doctorId: string,
  procedureId: string,
  current: AiConversationState
): Partial<AiConversationState> {
  if (mode === "times" && payload.slots) {
    return {
      doctor_id: doctorId,
      procedure_id: procedureId,
      intent: "booking",
      booking_step: "slot",
      offered_slots: payload.slots.map((s) => ({
        scheduled_at: s.scheduled_at,
        display: s.label,
      })),
      last_slot_query: {
        date: payload.date,
        period: payload.period ?? undefined,
      },
      pending_slot: undefined,
    };
  }

  if (mode === "days" && payload.days) {
    return {
      doctor_id: doctorId,
      procedure_id: procedureId,
      intent: "booking",
      booking_step: "day",
      offered_days: payload.days.map((d) => ({ date: d.date, label: d.label })),
      offered_slots: [],
      last_slot_query: undefined,
      pending_slot: undefined,
    };
  }

  return {
    doctor_id: doctorId,
    procedure_id: procedureId,
    intent: "booking",
    booking_step: current.booking_step ?? "day",
  };
}
