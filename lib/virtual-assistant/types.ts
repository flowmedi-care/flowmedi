export type AssistantTone = "formal" | "informal";

import type { AiState } from "@/lib/chatbot/state/types";
import type { ToolExecutionModesConfig } from "./agent-pipeline/confirmation-policy";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type DayHours = {
  open?: string;
  close?: string;
  lunch_start?: string;
  lunch_end?: string;
  closed?: boolean;
};

export type OperatingHours = Partial<Record<DayKey, DayHours>>;

export type VirtualAssistantSettings = {
  clinic_id: string;
  enabled: boolean;
  assistant_name: string | null;
  tone: AssistantTone;
  use_emojis: boolean;
  segment: string | null;
  short_description: string | null;
  google_maps_url: string | null;
  parking_info: string | null;
  accessibility_info: string | null;
  landmarks: string | null;
  has_multiple_units: boolean;
  human_handoff_enabled: boolean;
  human_handoff_hours: Record<string, unknown> | null;
  message_debounce_seconds: number;
  operating_hours: OperatingHours | null;
  holiday_policy: string | null;
  payment_methods: string[] | null;
  cancellation_policy: string | null;
  avg_wait_time: string | null;
  delivery_info: string | null;
  booking_requires_appointment: boolean;
  website_url: string | null;
  active_promotions: string | null;
  ai_model: string;
  max_context_messages: number;
  bot_active_start: string | null;
  bot_active_end: string | null;
  confirmation_flow_id?: string | null;
  confirmation_flow_template_name?: string | null;
  tool_execution_modes?: ToolExecutionModesConfig | null;
};

export type VirtualAssistantLocation = {
  id: string;
  clinic_id: string;
  name: string;
  address: string | null;
  google_maps_url: string | null;
  phone: string | null;
  operating_hours: OperatingHours | null;
  display_order: number;
};

export type VirtualAssistantFaq = {
  id: string;
  clinic_id: string;
  question: string;
  answer: string;
  display_order: number;
};

export type PendingTranscriptionJob = {
  messageId: string;
  jobId: string;
};

/** @deprecated use AiState from @/lib/chatbot */
export type BookingStep =
  | "procedure"
  | "doctor"
  | "day"
  | "slot"
  | "patient"
  | "confirm"
  | "done";

export type OfferedDay = {
  date: string;
  label: string;
};

export type OfferedSlot = {
  scheduled_at: string;
  display: string;
};

export type OfferedProcedure = {
  id: string;
  name: string;
};

export type LastSlotQuery = {
  date?: string;
  period?: "manha" | "tarde";
};

/**
 * Estado persistido em whatsapp_conversations.ai_state.
 * AiState (chatbot) + campos de infraestrutura e compat legada.
 */
export type AiConversationState = AiState & {
  pending_confirmation_appointment_id?: string;
  pending_reschedule_appointment_id?: string;
  /** @deprecated legado — preferir booking.* */
  intent?: string;
  booking_step?: BookingStep;
  doctor_id?: string;
  procedure_id?: string;
  service_id?: string;
  pending_slot?: string;
  offered_days?: OfferedDay[];
  offered_slots?: OfferedSlot[];
  offered_procedures?: OfferedProcedure[];
  last_slot_query?: LastSlotQuery;
  last_display_message?: string;
  last_reply_kind?: string;
  last_created_appointment_id?: string;
  journey_step_code?: string;
  timeout_followup_counts?: Partial<Record<string, number>>;
  resolve_quote_offer_done?: boolean;
  dimension_value_ids?: string[];
  pending_step?: string;
  pipeline_stage?: import("./agent-pipeline/stages").AgentPipelineStage;
  pipeline_stage_entered_at?: string;
  pipeline_last_transition_trigger?: string;
  pending_tool_confirmation?: Record<string, unknown>;
  contact_intent?: string;
  motivo_provavel?: string;
  confianca?: "alta" | "media" | "baixa";
};

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};

export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  mon: { open: "08:00", close: "18:00" },
  tue: { open: "08:00", close: "18:00" },
  wed: { open: "08:00", close: "18:00" },
  thu: { open: "08:00", close: "18:00" },
  fri: { open: "08:00", close: "18:00" },
  sat: { open: "08:00", close: "12:00" },
  sun: { closed: true },
};

export type { AiState } from "@/lib/chatbot/state/types";
