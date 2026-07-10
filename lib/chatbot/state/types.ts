export type OfferedSlot = {
  scheduled_at: string;
  display: string;
};

export type BookingState = {
  procedure_id?: string;
  doctor_id?: string;
  date?: string;
  offered_slots?: OfferedSlot[];
  pending_slot?: string;
  status: "collecting" | "confirming" | "done";
};

export type AiState = {
  patient_id?: string;
  booking?: BookingState;
  focused_appointment_id?: string;
  active_appointments?: string[];
  consecutive_tool_failures?: number;
  ai_processing_started_at?: string;
  pending_transcription_jobs?: Array<{ messageId: string; jobId: string }>;
  audio_transcription_retried_message_ids?: string[];
  bot_loop_detected_at?: string;
  handoff_reason?: string;
  bot_loop_window_since?: string;
};

export function initialAiState(): AiState {
  return { consecutive_tool_failures: 0 };
}

export function isActiveBooking(state: AiState): boolean {
  if (!state.booking) return false;
  return state.booking.status !== "done";
}
