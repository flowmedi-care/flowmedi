"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Brain,
  Database,
  Terminal,
  Code,
  FileText,
  Check,
  Loader2,
  Clock,
  Minus,
  Globe,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeatCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}

export function FeatCard({ title, description, children, className = "" }: FeatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative flex flex-col gap-2 overflow-hidden rounded-[20px] p-4",
        "bg-white dark:bg-neutral-900",
        "shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)]",
        "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(255,255,255,0.05),0_2px_4px_rgba(0,0,0,0.2)]",
        className
      )}
    >
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </motion.div>
  );
}

type PipelineStep = "request" | "router" | "agent" | "memory" | "tools" | "response";

const PIPELINE_STEPS: PipelineStep[] = [
  "request",
  "router",
  "agent",
  "memory",
  "tools",
  "response",
];

const STEP_LABELS: Record<PipelineStep, string> = {
  request: "Inbound",
  router: "Router",
  agent: "Agent",
  memory: "Jornada",
  tools: "Tools",
  response: "Reply",
};

export function PipelineCard({ activeStep }: { activeStep: string }) {
  const step = (PIPELINE_STEPS.includes(activeStep as PipelineStep)
    ? activeStep
    : "agent") as PipelineStep;
  const idx = PIPELINE_STEPS.indexOf(step);

  return (
    <div className="flex h-full flex-col justify-center gap-3 px-1">
      <div className="flex items-center justify-between gap-1">
        {PIPELINE_STEPS.map((s, i) => {
          const active = i <= idx;
          return (
            <div key={s} className="flex flex-1 flex-col items-center gap-1">
              <motion.div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-bold",
                  active
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground"
                )}
                animate={i === idx ? { scale: [1, 1.08, 1] } : {}}
                transition={{ repeat: i === idx ? Infinity : 0, duration: 2 }}
              >
                {i + 1}
              </motion.div>
              <span className="text-[9px] text-muted-foreground">{STEP_LABELS[s]}</span>
            </div>
          );
        })}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${((idx + 1) / PIPELINE_STEPS.length) * 100}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
}

export function MetricsCard({
  pending,
  stuck,
  blocked,
  throughput,
}: {
  pending: number;
  stuck: number;
  blocked: number;
  throughput: number;
}) {
  const stats = [
    { label: "Fila pendente", value: String(pending), trend: pending > 10 ? "alta" : "ok" },
    { label: "Debounce travado", value: String(stuck), trend: stuck > 0 ? "alerta" : "ok" },
    { label: "Bloqueadas", value: String(blocked), trend: blocked > 0 ? "alerta" : "ok" },
    { label: "Proc./hora", value: String(throughput), trend: "ok" },
  ];

  return (
    <div className="grid h-full grid-cols-2 gap-2">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-border/50 bg-muted/20 p-2.5 dark:bg-neutral-950/80"
        >
          <p className="text-[10px] text-muted-foreground">{s.label}</p>
          <p className="text-lg font-semibold">{s.value}</p>
          <p
            className={cn(
              "text-[10px]",
              s.trend === "alerta" ? "text-amber-600" : "text-emerald-600"
            )}
          >
            {s.trend === "alerta" ? "atenção" : "estável"}
          </p>
        </div>
      ))}
    </div>
  );
}

export type ActivityItem = {
  id: string;
  agent: string;
  action: string;
  status: "done" | "running" | "waiting" | "idle" | "failed";
  time?: string;
};

const STATUS_ICONS = {
  done: { icon: Check, color: "text-lime-500", bg: "bg-lime-500/15" },
  running: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-400/15" },
  waiting: { icon: Clock, color: "text-amber-400", bg: "bg-amber-400/15" },
  idle: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted/40" },
  failed: { icon: Minus, color: "text-red-400", bg: "bg-red-400/15" },
};

export function ActivityFeedCard({ items }: { items: ActivityItem[] }) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % items.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Nenhuma atividade recente
      </p>
    );
  }

  return (
    <div className="relative h-full min-h-[180px] overflow-hidden">
      {items.slice(0, 5).map((item, i) => {
        const slot = i - activeIdx;
        const abs = Math.abs(slot);
        const isActive = slot === 0;
        const si = STATUS_ICONS[item.status];
        const Icon = si.icon;

        return (
          <motion.div
            key={item.id}
            className="absolute left-0 right-0 mx-auto px-1"
            style={{ zIndex: isActive ? 30 : 20 - abs }}
            animate={{
              y: isActive ? 0 : slot < 0 ? -40 : 40,
              scale: isActive ? 1 : 0.92,
              opacity: abs > 2 ? 0 : isActive ? 1 : 0.5,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="flex items-start gap-2 rounded-xl border border-border/40 bg-muted/20 px-2.5 py-2 dark:bg-neutral-950/80">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                  si.bg,
                  si.color
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", item.status === "running" && "animate-spin")} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{item.agent}</span>
                  <span className="text-[10px] text-muted-foreground">{item.status}</span>
                </div>
                {isActive && (
                  <p className="truncate text-[11px] text-muted-foreground">{item.action}</p>
                )}
              </div>
              {item.time && isActive && (
                <span className="text-[10px] text-muted-foreground">{item.time}</span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function JourneyPhasesCard({
  phases,
}: {
  phases: Array<{ name: string; count: number; fill: number }>;
}) {
  const colors = [
    "from-violet-500 to-violet-400",
    "from-sky-500 to-sky-400",
    "from-emerald-500 to-emerald-400",
    "from-amber-500 to-amber-400",
  ];

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
      {phases.map((p, i) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-20 shrink-0 truncate text-[10px] font-medium">{p.name}</div>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", colors[i % colors.length])}
              initial={{ width: 0 }}
              animate={{ width: `${p.fill}%` }}
              transition={{ duration: 0.8, delay: i * 0.05 }}
            />
          </div>
          <span className="w-6 text-right text-[10px] font-semibold">{p.count}</span>
        </div>
      ))}
    </div>
  );
}

export function ToolInspectorCard({
  tools,
}: {
  tools: Array<{ name: string; calls: number; success_rate: number }>;
}) {
  const maxCalls = Math.max(...tools.map((t) => t.calls), 1);

  return (
    <div className="grid h-full grid-cols-2 gap-2">
      {tools.slice(0, 4).map((t) => (
        <div
          key={t.name}
          className="flex flex-col justify-between rounded-xl border border-border/50 p-2 dark:bg-neutral-950/50"
        >
          <div className="flex items-center justify-between">
            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-bold">{t.calls}</span>
          </div>
          <p className="truncate text-[10px] font-medium">{t.name}</p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(t.calls / maxCalls) * 100}%` }}
            />
          </div>
          <p className="text-[9px] text-muted-foreground">{t.success_rate}% ok</p>
        </div>
      ))}
    </div>
  );
}

export interface AgentBentoGridProps {
  activePipelineStep?: string;
  metrics?: {
    pending: number;
    stuck: number;
    blocked: number;
    throughput: number;
  };
  activityItems?: ActivityItem[];
  journeyPhases?: Array<{ name: string; count: number; fill: number }>;
  toolStats?: Array<{ name: string; calls: number; success_rate: number }>;
  className?: string;
}

export function AgentBentoGrid({
  activePipelineStep = "agent",
  metrics = { pending: 0, stuck: 0, blocked: 0, throughput: 0 },
  activityItems = [],
  journeyPhases = [],
  toolStats = [],
  className,
}: AgentBentoGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      <FeatCard
        title="Agent Pipeline"
        description="Fluxo em tempo real: inbound → router → agentes → tools → resposta"
        className="h-[240px] lg:col-span-1"
      >
        <PipelineCard activeStep={activePipelineStep} />
      </FeatCard>

      <FeatCard
        title="Fila operacional"
        description="Mensagens pendentes, debounce e conversas bloqueadas"
        className="h-[240px] lg:col-span-1"
      >
        <MetricsCard {...metrics} />
      </FeatCard>

      <FeatCard
        title="Activity Feed"
        description="Ações dos agentes e processamento WhatsApp"
        className="h-[240px] lg:col-span-1"
      >
        <ActivityFeedCard items={activityItems} />
      </FeatCard>

      <FeatCard
        title="Jornada por fase"
        description="Contatos com ação pendente em cada fase do CRM"
        className="h-[240px] lg:col-span-2"
      >
        <JourneyPhasesCard phases={journeyPhases} />
      </FeatCard>

      <FeatCard
        title="Tool Inspector"
        description="Uso e taxa de sucesso das ferramentas (24h)"
        className="h-[240px] lg:col-span-1"
      >
        <ToolInspectorCard tools={toolStats} />
      </FeatCard>
    </div>
  );
}

export default AgentBentoGrid;
