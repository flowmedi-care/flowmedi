export type OfferedSlot = {
  scheduled_at: string;
  display: string;
};

export type OfferedOption = {
  id: string;
  name: string;
  index?: number;
};

export type OfferedDay = {
  date: string;
  label: string;
  index?: number;
};

/** Last interactive menu the patient actually received (committed after outbound). */
export type ActiveSelectionType =
  | "doctor"
  | "procedure"
  | "day"
  | "slot"
  | "appointment";

export type ActiveSelectionOption = {
  id: string;
  label: string;
  index: number;
};

export type ActiveSelection = {
  type: ActiveSelectionType;
  options: ActiveSelectionOption[];
  /** ISO of outbound commit (when the menu was confirmed delivered). */
  created_at?: string;
};

export type SelectionPeriod = "manha" | "tarde" | null;

/** Search filters that derive offered_slots / pending_slot. */
export type SelectionContext = {
  version: number;
  doctor_id?: string;
  procedure_id?: string;
  date?: string;
  period?: SelectionPeriod;
  duration_minutes?: number | null;
};

export type BookingState = {
  procedure_id?: string;
  doctor_id?: string;
  date?: string;
  offered_slots?: OfferedSlot[];
  pending_slot?: string;
  /** Current search filter snapshot; bump version invalidates slot selection. */
  selection_context?: SelectionContext;
  /** Version at which offered_slots / pending_slot were last written. */
  selection_epoch?: number;
  status: "collecting" | "confirming" | "done";
};

export type ConversationFlowState = {
  active_workflow_id: string;
  mode: "express" | "assisted" | "strict";
  satisfied: string[];
  pending: string[];
  collected: Record<string, unknown>;
  focus_goal_id?: string;
  pending_confirmation?: {
    goal_id: string;
    tool: string;
    args: Record<string, unknown>;
  };
  current_operation?: {
    status: "active" | "completed" | "abandoned";
    endReason?:
      | "no_eligible"
      | "too_early"
      | "disabled"
      | "user_interrupt"
      | "workflow_switch";
  };
  mutation_done?: Record<string, boolean>;
};

/** Soft fork when starting booking with upcoming appointments already on file. */
export type BookingForkState = {
  status: "awaiting_choice" | "new" | "alter";
};

export type AiState = {
  patient_id?: string;
  booking?: BookingState;
  conversation_flow?: ConversationFlowState;
  /** Soft path: new booking vs alter existing (see booking-fork). */
  booking_fork?: BookingForkState;
  /** Idempotence for deterministic rules (skip when fingerprint unchanged). */
  last_deterministic_action?: {
    id: string;
    fingerprint: string;
    outcome: "empty" | "success" | "blocked";
  };
  offered_doctors?: OfferedOption[];
  offered_procedures?: OfferedOption[];
  offered_days?: OfferedDay[];
  /**
   * Authoritative menu for bare-index resolution (committed with successful outbound).
   * See docs/contracts/reference-resolution.md.
   */
  active_selection?: ActiveSelection;
  /** Draft from tools this turn — only becomes active_selection after reply_sent. */
  pending_active_selection?: ActiveSelection;
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
