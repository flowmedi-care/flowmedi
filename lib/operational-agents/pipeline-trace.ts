import type { AgentRunRow } from "./agent-runs";
import type { AiEventRow } from "@/lib/virtual-assistant/diagnostics";

export type PipelineStep =
  | "request"
  | "router"
  | "agent"
  | "memory"
  | "tools"
  | "response"
  | "handoff"
  | "retry"
  | "done"
  | "failed";

export type PipelineChainStatus = "running" | "done" | "failed" | "idle";

export type PipelineTrace = {
  activeStep: PipelineStep;
  activePathIds: string[];
  activeNodeIds: string[];
  lastAction?: string;
  lastAgentType?: string;
  chainStatus: PipelineChainStatus;
  isLive: boolean;
};

const DEMO_CYCLE: PipelineStep[] = [
  "request",
  "router",
  "agent",
  "memory",
  "tools",
  "response",
];

const EVENT_TO_STEP: Record<string, PipelineStep> = {
  webhook_inbound: "request",
  simulate_inbound: "request",
  routing_decision: "router",
  debounce_scheduled: "router",
  cron_batch_start: "router",
  cron_conversation_processed: "router",
  pending_messages: "router",
  processing_start: "agent",
  openai_start: "agent",
  openai_end: "agent",
  reply_sent: "response",
  confirmation_flow_handled: "response",
  handoff: "handoff",
  flow_discarded: "failed",
  error: "failed",
  queue_cleared: "done",
  ai_reactivated: "retry",
};

const RUN_TYPE_TO_STEP: Record<string, PipelineStep> = {
  booking: "tools",
  journey: "memory",
  queue: "router",
  virtual_assistant: "agent",
};

function pathsForStep(step: PipelineStep): string[] {
  switch (step) {
    case "request":
      return ["msg-to-router"];
    case "router":
      return ["msg-to-router", "router-to-agent"];
    case "agent":
      return ["router-to-agent"];
    case "memory":
      return ["router-to-agent", "agent-to-journey", "journey-to-agent-back"];
    case "tools":
      return ["router-to-agent", "agent-to-tools", "tools-to-agent-back"];
    case "response":
      return ["agent-to-router-back", "router-to-msg-back"];
    case "handoff":
      return ["agent-to-router-back"];
    case "retry":
      return ["msg-to-router", "router-to-agent"];
    case "done":
      return ["chain-end"];
    case "failed":
      return ["chain-end"];
    default:
      return [];
  }
}

function nodesForStep(step: PipelineStep): string[] {
  switch (step) {
    case "request":
      return ["A"];
    case "router":
    case "retry":
      return ["Router"];
    case "agent":
      return ["C"];
    case "memory":
      return ["C", "B"];
    case "tools":
      return ["C", "D"];
    case "response":
      return ["C", "Router", "A"];
    case "handoff":
      return ["C", "Router"];
    case "done":
    case "failed":
      return ["C"];
    default:
      return [];
  }
}

function chainStatusFromStep(step: PipelineStep): PipelineChainStatus {
  if (step === "done") return "done";
  if (step === "failed") return "failed";
  if (step === "request" && !step) return "idle";
  return "running";
}

type TraceInput = {
  events: AiEventRow[];
  agentRuns: AgentRunRow[];
  lastActivityAt?: string | null;
};

function resolveStepFromSources(input: TraceInput): {
  step: PipelineStep;
  lastAction?: string;
  lastAgentType?: string;
} {
  const items: Array<{
    at: number;
    step: PipelineStep;
    action?: string;
    agentType?: string;
  }> = [];

  for (const e of input.events) {
    const step = EVENT_TO_STEP[e.stage];
    if (step) {
      items.push({
        at: new Date(e.created_at).getTime(),
        step,
        action: e.stage,
      });
    }
  }

  for (const r of input.agentRuns) {
    const stepFromType = RUN_TYPE_TO_STEP[r.agent_type];
    let step: PipelineStep =
      r.status === "failed"
        ? "failed"
        : r.status === "done" && r.action === "batch_run"
          ? "done"
          : stepFromType ?? "agent";

    if (r.agent_type === "queue" && r.status === "running") {
      step = "retry";
    }

    items.push({
      at: new Date(r.created_at).getTime(),
      step,
      action: r.action,
      agentType: r.agent_type,
    });
  }

  items.sort((a, b) => b.at - a.at);

  if (items.length === 0) {
    return { step: "request" };
  }

  const latest = items[0]!;
  return {
    step: latest.step,
    lastAction: latest.action,
    lastAgentType: latest.agentType,
  };
}

export function resolvePipelineTrace(input: TraceInput): PipelineTrace {
  const idleThresholdMs = 30_000;
  const lastAt = input.lastActivityAt
    ? new Date(input.lastActivityAt).getTime()
    : Math.max(
        input.events[0] ? new Date(input.events[0].created_at).getTime() : 0,
        input.agentRuns[0] ? new Date(input.agentRuns[0].created_at).getTime() : 0
      );

  const isLive = lastAt > 0 && Date.now() - lastAt < idleThresholdMs;

  if (!isLive) {
    return {
      activeStep: "request",
      activePathIds: pathsForStep("request"),
      activeNodeIds: nodesForStep("request"),
      chainStatus: "idle",
      isLive: false,
    };
  }

  const { step, lastAction, lastAgentType } = resolveStepFromSources(input);

  return {
    activeStep: step,
    activePathIds: pathsForStep(step),
    activeNodeIds: nodesForStep(step),
    lastAction,
    lastAgentType,
    chainStatus: chainStatusFromStep(step),
    isLive: true,
  };
}

export function getDemoPipelineStep(tick: number): PipelineStep {
  return DEMO_CYCLE[tick % DEMO_CYCLE.length]!;
}

export function buildDemoTrace(tick: number): PipelineTrace {
  const step = getDemoPipelineStep(tick);
  return {
    activeStep: step,
    activePathIds: pathsForStep(step),
    activeNodeIds: nodesForStep(step),
    chainStatus: "idle",
    isLive: false,
  };
}

export { DEMO_CYCLE, pathsForStep, nodesForStep };
