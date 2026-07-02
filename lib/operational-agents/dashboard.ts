import type { SupabaseClient } from "@supabase/supabase-js";
import { gatherAssistantDiagnostics } from "@/lib/virtual-assistant/diagnostics";
import { listRecentAgentRuns } from "./agent-runs";
import { countPendingByPhase } from "./journey-list";

export type AgentDashboardData = {
  health: Awaited<ReturnType<typeof gatherAssistantDiagnostics>>["health"];
  agentRuns: Awaited<ReturnType<typeof listRecentAgentRuns>>;
  pendingByPhase: Record<string, number>;
  toolStats: Array<{ tool_name: string; calls: number; success_rate: number }>;
  activePipelineStep: string;
  flows: Awaited<ReturnType<typeof gatherAssistantDiagnostics>>["flows"];
};

export async function gatherAgentDashboard(
  supabase: SupabaseClient,
  clinicId: string
): Promise<AgentDashboardData> {
  const [diagnostics, agentRuns, pendingByPhase, toolStatsRes] = await Promise.all([
    gatherAssistantDiagnostics(supabase, clinicId),
    listRecentAgentRuns(supabase, clinicId, 30),
    countPendingByPhase(supabase, clinicId),
    supabase
      .from("whatsapp_ai_tool_log")
      .select("tool_name, success")
      .eq("clinic_id", clinicId)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const toolMap = new Map<string, { total: number; success: number }>();
  for (const row of toolStatsRes.data ?? []) {
    const key = String(row.tool_name);
    const cur = toolMap.get(key) ?? { total: 0, success: 0 };
    cur.total++;
    if (row.success) cur.success++;
    toolMap.set(key, cur);
  }

  const toolStats = [...toolMap.entries()]
    .map(([tool_name, v]) => ({
      tool_name,
      calls: v.total,
      success_rate: v.total > 0 ? Math.round((v.success / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 8);

  const latestRun = agentRuns[0];
  let activePipelineStep = "request";
  if (latestRun) {
    if (latestRun.agent_type === "booking") activePipelineStep = "tools";
    else if (latestRun.agent_type === "journey") activePipelineStep = "memory";
    else if (latestRun.agent_type === "queue") activePipelineStep = "router";
    else if (latestRun.status === "running") activePipelineStep = "agent";
    else activePipelineStep = "response";
  }

  return {
    health: diagnostics.health,
    agentRuns,
    pendingByPhase,
    toolStats,
    activePipelineStep,
    flows: diagnostics.flows.slice(0, 20),
  };
}
