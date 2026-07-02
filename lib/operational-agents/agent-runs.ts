import type { SupabaseClient } from "@supabase/supabase-js";

export type OperationalAgentType = "booking" | "journey" | "queue" | "virtual_assistant";
export type OperationalAgentStatus = "running" | "done" | "waiting" | "idle" | "failed";

export type AgentRunInput = {
  clinicId: string;
  agentType: OperationalAgentType;
  status: OperationalAgentStatus;
  action: string;
  contactId?: string | null;
  conversationId?: string | null;
  detail?: Record<string, unknown>;
  durationMs?: number;
};

export async function logAgentRun(
  supabase: SupabaseClient,
  input: AgentRunInput
): Promise<void> {
  try {
    await supabase.from("operational_agent_runs").insert({
      clinic_id: input.clinicId,
      agent_type: input.agentType,
      status: input.status,
      action: input.action,
      contact_id: input.contactId ?? null,
      conversation_id: input.conversationId ?? null,
      detail: input.detail ?? {},
      duration_ms: input.durationMs ?? null,
    });
  } catch (e) {
    console.warn("[OperationalAgents] logAgentRun:", e);
  }
}

export type AgentRunRow = {
  id: string;
  clinic_id: string;
  agent_type: OperationalAgentType;
  status: OperationalAgentStatus;
  action: string;
  contact_id: string | null;
  conversation_id: string | null;
  detail: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
};

export async function listRecentAgentRuns(
  supabase: SupabaseClient,
  clinicId: string,
  limit = 50
): Promise<AgentRunRow[]> {
  const { data, error } = await supabase
    .from("operational_agent_runs")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[OperationalAgents] listRecentAgentRuns:", error.message);
    return [];
  }

  return (data ?? []) as AgentRunRow[];
}
