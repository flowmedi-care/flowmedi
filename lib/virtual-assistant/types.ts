export type AssistantTone = "formal" | "informal";

import type { AgentPipelineStage } from "./agent-pipeline/stages";
import type {
  PendingToolConfirmation,
  ToolExecutionModesConfig,
} from "./agent-pipeline/confirmation-policy";

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
  /** Modo de execução por ferramenta: auto | human_confirm */
  tool_execution_modes?: ToolExecutionModesConfig | null;
  /** Usa motor LangGraph em vez do loop legado em agent.ts */
  use_langgraph_pipeline?: boolean;
  /** Executa LangGraph em paralelo para comparação (shadow logging) */
  langgraph_shadow_mode?: boolean;
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

export type LastSlotQuery = {
  date?: string;
  period?: "manha" | "tarde";
};

export type AiConversationState = {
  intent?: string;
  booking_step?: BookingStep;
  last_created_appointment_id?: string;
  doctor_id?: string;
  procedure_id?: string;
  service_id?: string;
  pending_slot?: string;
  offered_days?: OfferedDay[];
  offered_slots?: OfferedSlot[];
  last_slot_query?: LastSlotQuery;
  /** Última lista de dias/horários mostrada ao paciente (display_message). */
  last_display_message?: string;
  /** Tipo da última resposta (ex. invalid_slot_selection) — evita re-list loop. */
  last_reply_kind?: string;
  dimension_value_ids?: string[];
  patient_id?: string;
  pending_confirmation_appointment_id?: string;
  /** Consulta a remarcar após resposta "Remarcar" no WhatsApp Flow */
  pending_reschedule_appointment_id?: string;
  pending_transcription_jobs?: PendingTranscriptionJob[];
  /** Etapa atual do fluxo guiado (booking, price, etc.) */
  pending_step?: string;
  /** Etapa na Jornada do Contato (CRM) */
  journey_step_code?: string;
  contact_intent?: string;
  pending_action?: string;
  motivo_provavel?: string;
  confianca?: "alta" | "media" | "baixa";
  active_appointments?: string[];
  focused_appointment_id?: string;
  channel?: string;
  captacao_substep?: number;
  followup_count?: number;
  confirmation_completed?: ("7d" | "2d" | "day")[];
  /** IDs de mensagens que já tiveram retry de transcrição após erro 500 */
  audio_transcription_retried_message_ids?: string[];
  /** Loop bot↔bot detectado — IA silenciada sem resposta */
  bot_loop_detected_at?: string;
  /** Motivo do último handoff (ex. bot_loop_detected) */
  handoff_reason?: string;
  /** Evita processamento duplicado (webhook + cron em paralelo) */
  ai_processing_started_at?: string;
  /** Etapa atual do pipeline do agente */
  pipeline_stage?: AgentPipelineStage;
  pipeline_stage_entered_at?: string;
  pipeline_last_transition_trigger?: string;
  /** Confirmação pendente de ferramenta mutável (modo human_confirm) */
  pending_tool_confirmation?: PendingToolConfirmation;
  /** resolve_quote_offer executado nesta conversa */
  resolve_quote_offer_done?: boolean;
  /** Falhas consecutivas de ferramenta (para escalação) */
  consecutive_tool_failures?: number;
  /** Contagem de follow-ups de timeout por journey step */
  timeout_followup_counts?: Partial<Record<string, number>>;
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
