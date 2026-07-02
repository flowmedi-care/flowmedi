"use client";

import { useCallback, useEffect, useState } from "react";
import { ActivityFeedCard, type ActivityItem } from "@/components/ui/agent-bento-grid";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/toast";
import type { AgentDashboardData } from "@/lib/operational-agents/dashboard";
import type { MessageFlowTrace } from "@/lib/virtual-assistant/diagnostics-flow";

const AGENT_LABELS: Record<string, string> = {
  booking: "Booking",
  journey: "Jornada",
  queue: "Fila",
  virtual_assistant: "VA",
};

function flowsToActivity(flows: MessageFlowTrace[]): ActivityItem[] {
  return flows.map((f, i) => ({
    id: `wa-${i}`,
    agent: f.contactLabel ?? "WhatsApp",
    action: f.steps.map((s) => s.title).join(" → ") || f.messagePreview,
    status:
      f.status === "discarded"
        ? "failed"
        : f.status === "in_progress"
          ? "running"
          : "done",
    time: f.startedAt
      ? new Date(f.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : undefined,
  }));
}

function runsToActivity(runs: AgentDashboardData["agentRuns"]): ActivityItem[] {
  return runs.map((r) => ({
    id: r.id,
    agent: AGENT_LABELS[r.agent_type] ?? r.agent_type,
    action: String((r.detail as { displayName?: string })?.displayName ?? r.action),
    status: r.status,
    time: new Date(r.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  }));
}

type Props = {
  onJourneyRunComplete?: () => void;
  pollMs?: number;
};

export function AgentActivityFeed({ onJourneyRunComplete, pollMs = 5000 }: Props) {
  const [tab, setTab] = useState<"whatsapp" | "journey">("whatsapp");
  const [data, setData] = useState<AgentDashboardData | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/agents/dashboard");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, pollMs);
    return () => clearInterval(interval);
  }, [load, pollMs]);

  async function handleRunJourney() {
    setRunning(true);
    try {
      const res = await fetch("/api/agents/journey/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao executar");
      toast(
        `Journey Agent: ${json.succeeded} ok, ${json.failed} falhas, ${json.skipped} ignoradas`,
        "success"
      );
      await load();
      onJourneyRunComplete?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao executar agente", "error");
    } finally {
      setRunning(false);
    }
  }

  const whatsappItems = data ? flowsToActivity(data.flows) : [];
  const journeyItems = data ? runsToActivity(data.agentRuns.filter((r) => r.agent_type === "journey")) : [];

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["whatsapp", "journey"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "whatsapp" ? "WhatsApp" : "Jornada"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="h-8 gap-1 text-xs" onClick={handleRunJourney} disabled={running}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Executar pendentes
          </Button>
        </div>
      </div>

      <div className="min-h-[280px] flex-1">
        <ActivityFeedCard items={tab === "whatsapp" ? whatsappItems : journeyItems} />
      </div>
    </div>
  );
}
