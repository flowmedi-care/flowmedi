"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChatCircle,
  Brain,
  Database,
  TerminalWindow,
  type Icon,
} from "@phosphor-icons/react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PipelineTrace, PipelineStep } from "@/lib/operational-agents/pipeline-trace";
import {
  buildDemoTrace,
  DEMO_CYCLE,
  nodesForStep,
  pathsForStep,
} from "@/lib/operational-agents/pipeline-trace";

const VW = 320;
const VH = 240;
const VW_EXPANDED = 480;
const VH_EXPANDED = 360;

interface NodeConfig {
  id: string;
  x: number;
  y: number;
  icon?: Icon;
  label?: string;
  type: "box" | "circle";
}

const NODES: NodeConfig[] = [
  { id: "A", x: 50, y: 120, icon: ChatCircle, label: "MENSAGEM", type: "box" },
  { id: "Router", x: 125, y: 120, type: "circle" },
  { id: "C", x: 200, y: 120, icon: Brain, label: "AGENTE", type: "box" },
  { id: "B", x: 280, y: 50, icon: Database, label: "JORNADA", type: "box" },
  { id: "D", x: 280, y: 190, icon: TerminalWindow, label: "FERRAM.", type: "box" },
];

interface FlowPath {
  id: string;
  d: string;
  activeSteps: PipelineStep[];
  colorClass: string;
  dashed?: boolean;
}

const BASE_PATHS = [
  "M 78 120 L 113 120",
  "M 137 120 L 172 120",
  "M 200 92 L 200 50 L 252 50",
  "M 200 148 L 200 190 L 252 190",
  "M 172 120 L 137 120",
  "M 113 120 L 78 120",
  "M 252 50 L 200 50 L 200 92",
  "M 252 190 L 200 190 L 200 148",
  "M 200 120 L 137 120",
];

const PATHS: FlowPath[] = [
  {
    id: "msg-to-router",
    d: "M 78 120 L 113 120",
    activeSteps: ["request", "router", "retry"],
    colorClass: "text-cyan-500 dark:text-cyan-400",
  },
  {
    id: "router-to-agent",
    d: "M 137 120 L 172 120",
    activeSteps: ["router", "agent", "retry", "memory", "tools"],
    colorClass: "text-violet-500 dark:text-violet-400",
  },
  {
    id: "agent-to-journey",
    d: "M 200 92 L 200 50 L 252 50",
    activeSteps: ["memory"],
    colorClass: "text-fuchsia-500 dark:text-fuchsia-400",
  },
  {
    id: "agent-to-tools",
    d: "M 200 148 L 200 190 L 252 190",
    activeSteps: ["tools"],
    colorClass: "text-emerald-500 dark:text-emerald-400",
  },
  {
    id: "journey-to-agent-back",
    d: "M 252 50 L 200 50 L 200 92",
    activeSteps: ["memory", "done"],
    colorClass: "text-fuchsia-500 dark:text-fuchsia-400",
  },
  {
    id: "tools-to-agent-back",
    d: "M 252 190 L 200 190 L 200 148",
    activeSteps: ["tools", "done"],
    colorClass: "text-emerald-500 dark:text-emerald-400",
  },
  {
    id: "agent-to-router-back",
    d: "M 172 120 L 137 120",
    activeSteps: ["response", "handoff"],
    colorClass: "text-amber-500 dark:text-amber-400",
  },
  {
    id: "router-to-msg-back",
    d: "M 113 120 L 78 120",
    activeSteps: ["response"],
    colorClass: "text-cyan-500 dark:text-cyan-400",
  },
  {
    id: "chain-end",
    d: "M 200 120 L 137 120",
    activeSteps: ["done", "failed"],
    colorClass: "text-rose-500 dark:text-rose-400",
    dashed: true,
  },
];

const NODE_COLORS: Record<
  string,
  { buttonBg: string; buttonBorder: string }
> = {
  A: { buttonBg: "bg-cyan-500", buttonBorder: "border-cyan-600" },
  Router: { buttonBg: "bg-amber-500", buttonBorder: "border-amber-600" },
  C: { buttonBg: "bg-violet-500", buttonBorder: "border-violet-600" },
  B: { buttonBg: "bg-fuchsia-500", buttonBorder: "border-fuchsia-600" },
  D: { buttonBg: "bg-emerald-500", buttonBorder: "border-emerald-600" },
};

type GraphCanvasProps = {
  step: PipelineStep;
  activePathIds: string[];
  activeNodeIds: string[];
  expanded?: boolean;
  lastAction?: string;
  gridId: string;
};

function PipelineGraphCanvas({
  step,
  activePathIds,
  activeNodeIds,
  expanded,
  lastAction,
  gridId,
}: GraphCanvasProps) {
  const vw = expanded ? VW_EXPANDED : VW;
  const vh = expanded ? VH_EXPANDED : VH;
  const scale = expanded ? 1.35 : 1;

  const isNodeActive = (nodeId: string) => {
    if (activeNodeIds.length > 0) {
      return activeNodeIds.includes(nodeId);
    }
    return nodesForStep(step).includes(nodeId);
  };

  const pathActive = (p: FlowPath) =>
    activePathIds.includes(p.id) || p.activeSteps.includes(step);

  return (
    <div
      className={cn(
        "relative flex h-full w-full select-none items-center justify-center overflow-hidden rounded-xl bg-neutral-50 p-2 dark:bg-neutral-950/80",
        expanded && "min-h-[60vh] rounded-none bg-white p-8 dark:bg-neutral-950"
      )}
    >
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <pattern id={gridId} width="16" height="16" patternUnits="userSpaceOnUse">
            <circle
              cx="1.5"
              cy="1.5"
              r="0.75"
              fill="currentColor"
              className="text-zinc-200 dark:text-zinc-800/60"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${gridId})`} />
      </svg>

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        {BASE_PATHS.map((d, i) => (
          <path
            key={`base-${i}`}
            d={d}
            fill="none"
            stroke="currentColor"
            className="text-zinc-200 dark:text-zinc-800/80"
            strokeWidth="1"
          />
        ))}

        {PATHS.map((p) => {
          if (!pathActive(p)) return null;
          return (
            <g key={p.id}>
              <motion.path
                d={p.d}
                fill="none"
                stroke="currentColor"
                className={p.colorClass}
                strokeWidth="3.5"
                strokeOpacity="0.2"
                strokeDasharray={p.dashed ? "4 3" : undefined}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
              />
              <motion.path
                d={p.d}
                fill="none"
                stroke="currentColor"
                className={p.colorClass}
                strokeWidth="1.5"
                strokeDasharray={p.dashed ? "4 3" : undefined}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
              />
            </g>
          );
        })}

        {NODES.map((node) => {
          const isBox = node.type === "box";
          const w = (isBox ? 56 : 24) * scale;
          const h = (isBox ? 56 : 24) * scale;
          const isActive = isNodeActive(node.id);
          const colorStyles = NODE_COLORS[node.id];
          const nx = expanded ? node.x * (vw / VW) : node.x;
          const ny = expanded ? node.y * (vh / VH) : node.y;

          return (
            <foreignObject
              key={node.id}
              x={nx - w / 2}
              y={ny - h / 2}
              width={w}
              height={h}
              className="overflow-visible"
            >
              <div className="flex h-full w-full items-center justify-center">
                {isBox && node.icon ? (
                  <div
                    className={cn(
                      "flex h-full w-full flex-col items-center justify-center rounded-[14px] border text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.08)]",
                      colorStyles.buttonBg,
                      colorStyles.buttonBorder,
                      isActive && "ring-2 ring-white/40",
                      step === "failed" && node.id === "C" && "opacity-70",
                      step === "done" && node.id === "C" && "ring-2 ring-lime-400/60"
                    )}
                  >
                    <node.icon className="mb-0.5 h-5 w-5" weight="fill" />
                    <span className="select-none text-[8.5px] font-mono font-bold tracking-wider">
                      {node.label}
                    </span>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border-2 shadow-sm transition-all duration-300",
                      isActive
                        ? "border-amber-500/70 bg-amber-500/20"
                        : "border-zinc-300 bg-background/80 dark:border-zinc-800"
                    )}
                  >
                    <motion.div
                      className={cn(
                        "h-2.5 w-2.5 rounded-full border border-dashed",
                        isActive ? "border-amber-500" : "border-zinc-400 dark:border-zinc-600"
                      )}
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                    />
                  </div>
                )}
              </div>
            </foreignObject>
          );
        })}
      </svg>

      {lastAction && expanded && (
        <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-background/90 px-3 py-1 text-[10px] font-mono text-muted-foreground backdrop-blur-sm">
          {lastAction}
        </div>
      )}
    </div>
  );
}

export type AgentPipelineGraphProps = {
  trace?: PipelineTrace | null;
  showExpandButton?: boolean;
  className?: string;
};

export function AgentPipelineGraph({
  trace,
  showExpandButton = true,
  className,
}: AgentPipelineGraphProps) {
  const gridId = useId().replace(/:/g, "");
  const [expanded, setExpanded] = useState(false);
  const [demoTick, setDemoTick] = useState(0);

  const isLive = trace?.isLive ?? false;
  const demoTrace = buildDemoTrace(demoTick);
  const effective = isLive && trace ? trace : demoTrace;
  const step = effective.activeStep;
  const activePathIds =
    isLive && trace ? trace.activePathIds : pathsForStep(step);
  const activeNodeIds =
    isLive && trace ? trace.activeNodeIds : nodesForStep(step);

  useEffect(() => {
    if (isLive) return;
    const interval = setInterval(() => {
      setDemoTick((prev) => (prev + 1) % DEMO_CYCLE.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isLive]);

  const closeExpanded = useCallback(() => setExpanded(false), []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeExpanded();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, closeExpanded]);

  const canvas = (
    <PipelineGraphCanvas
      step={step}
      activePathIds={activePathIds}
      activeNodeIds={activeNodeIds}
      expanded={expanded}
      lastAction={trace?.lastAction}
      gridId={expanded ? `${gridId}-fs` : gridId}
    />
  );

  return (
    <>
      <div className={cn("relative h-full min-h-[180px] w-full", className)}>
        {showExpandButton && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 z-20 h-7 w-7 bg-background/60 backdrop-blur-sm"
            onClick={() => setExpanded(true)}
            aria-label="Expandir pipeline"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {canvas}
        {!isLive && (
          <span className="absolute bottom-1 left-2 text-[8px] font-mono text-muted-foreground/70">
            demo
          </span>
        )}
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-neutral-950"
              >
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Agent Pipeline</p>
                    <p className="text-xs text-muted-foreground">
                      Fluxo completo dos agentes — mensagem, roteador, agente, jornada e ferramentas
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={closeExpanded}
                  >
                    <Minimize2 className="h-4 w-4" />
                    Contrair
                  </Button>
                </div>
                <div className="relative flex-1">{canvas}</div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

export default AgentPipelineGraph;
