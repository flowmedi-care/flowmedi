"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentBentoGrid, type ActivityItem } from "@/components/ui/agent-bento-grid";
import { JOURNEY_PHASE_LABELS } from "@/lib/contact-journey";
import type { JourneyPhase } from "@/lib/contact-journey";
import type { AgentDashboardData } from "@/lib/operational-agents/dashboard";
import { Skeleton } from "@/components/ui/skeleton";

const AGENT_LABELS: Record<string, string> = {
  booking: "Booking Agent",
  journey: "Journey Agent",
  queue: "Queue Agent",
  virtual_assistant: "Assistente Virtual",
};

function formatActivity(data: AgentDashboardData): ActivityItem[] {
  const fromRuns = data.agentRuns.map((r) => ({
    id: r.id,
    agent: AGENT_LABELS[r.agent_type] ?? r.agent_type,
    action: r.action,
    status: r.status,
    time: r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : undefined,
  }));

  const fromFlows = data.flows.slice(0, 5).map((f, i) => ({
    id: `flow-${i}`,
    agent: "WhatsApp",
    action: f.steps.map((s) => s.title).join(" → ") || f.messagePreview,
    status: (f.status === "discarded"
      ? "failed"
      : f.status === "in_progress"
        ? "running"
        : "done") as ActivityItem["status"],
  }));

  return [...fromRuns, ...fromFlows].slice(0, 12);
}

function formatPhases(pendingByPhase: Record<string, number>) {
  const entries = Object.entries(pendingByPhase) as [JourneyPhase, number][];
  const max = Math.max(...entries.map(([, c]) => c), 1);
  return entries.map(([phase, count]) => ({
    name: JOURNEY_PHASE_LABELS[phase] ?? phase,
    count,
    fill: Math.round((count / max) * 100),
  }));
}

type Props = {
  compact?: boolean;
  pollMs?: number;
};

export function FlowmediAgentBento({ compact, pollMs = 8000 }: Props) {
  const [data, setData] = useState<AgentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/dashboard");
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, pollMs);
    return () => clearInterval(interval);
  }, [load, pollMs]);

  if (loading && !data) {
    return <Skeleton className="h-[500px] w-full rounded-2xl" />;
  }

  if (!data) return null;

  const throughput = data.agentRuns.filter(
    (r) => r.agent_type === "queue" && r.status === "done"
  ).length;

  return (
    <AgentBentoGrid
      pipelineTrace={data.pipelineTrace}
      metrics={{
        pending: data.health.pendingInboundCount,
        stuck: data.health.stuckDebounceCount,
        blocked: data.health.blockedConversationCount,
        throughput,
      }}
      activityItems={formatActivity(data)}
      journeyPhases={formatPhases(data.pendingByPhase)}
      toolStats={data.toolStats.map((t) => ({
        name: t.tool_name,
        calls: t.calls,
        success_rate: t.success_rate,
      }))}
      className={compact ? "md:grid-cols-2 lg:grid-cols-3" : undefined}
    />
  );
}
