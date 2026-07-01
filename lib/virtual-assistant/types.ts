export type AssistantTone = "formal" | "informal";

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

export type AiConversationState = {
  intent?: string;
  doctor_id?: string;
  procedure_id?: string;
  service_id?: string;
  pending_slot?: string;
  dimension_value_ids?: string[];
  patient_id?: string;
  pending_confirmation_appointment_id?: string;
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
  /** Evita processamento duplicado (webhook + cron em paralelo) */
  ai_processing_started_at?: string;
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
