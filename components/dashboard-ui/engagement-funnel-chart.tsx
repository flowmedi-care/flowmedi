"use client";

import { cn } from "@/lib/utils";
import type {
  CumulativeFunnelStage,
  FunnelOutcomeBranch,
} from "@/app/dashboard/crm/pipeline-actions";

export type EngagementFunnelStage = CumulativeFunnelStage;
export type EngagementFunnelBranch = FunnelOutcomeBranch;

const STAGE_HEIGHT = 56;
const STAGE_GAP = 6;
const BRANCH_HEIGHT = 48;
const MAX_FUNNEL_WIDTH = 240;
const MIN_SEGMENT_WIDTH = 56;
const LABEL_WIDTH = 130;
const STEP_COL_WIDTH = 36;

/** Gradiente monocromático (primary / violet) do claro ao escuro */
function stageColor(index: number, total: number): string {
  const startHue = 158;
  const startLight = 72;
  const endLight = 38;
  const t = total <= 1 ? 0 : index / (total - 1);
  const lightness = startLight - t * (startLight - endLight);
  const saturation = 55 + t * 15;
  return `hsl(${startHue} ${saturation}% ${lightness}%)`;
}

function branchColor(index: number): string {
  const hues = [158, 145, 38];
  const lights = [42, 48, 45];
  return `hsl(${hues[index] ?? 158} 55% ${lights[index] ?? 45}%)`;
}

function segmentWidths(values: number[]): number[] {
  const top = values[0] ?? 1;
  const max = Math.max(top, 1);
  return values.map((v) =>
    Math.max((v / max) * MAX_FUNNEL_WIDTH, v > 0 ? MIN_SEGMENT_WIDTH : MIN_SEGMENT_WIDTH * 0.5)
  );
}

function TrapezoidShape({
  topWidth,
  bottomWidth,
  height,
  fill,
  value,
  isTriangle,
}: {
  topWidth: number;
  bottomWidth: number;
  height: number;
  fill: string;
  value: number;
  isTriangle?: boolean;
}) {
  const halfTop = topWidth / 2;
  const halfBottom = bottomWidth / 2;
  const points = isTriangle
    ? `${-halfTop},0 ${halfTop},0 0,${height}`
    : `${-halfTop},0 ${halfTop},0 ${halfBottom},${height} ${-halfBottom},${height}`;

  return (
    <g>
      <polygon points={points} fill={fill} />
      <text
        y={isTriangle ? height * 0.62 : height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize={16}
        fontWeight={700}
        style={{ fontFamily: "inherit" }}
      >
        {value}
      </text>
    </g>
  );
}

function StepBadge({ step, y }: { step: number; y: number }) {
  return (
    <g transform={`translate(0, ${y})`}>
      <circle cx={0} cy={0} r={14} fill="hsl(var(--muted))" />
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fill="hsl(var(--muted-foreground))"
        fontSize={12}
        fontWeight={600}
        style={{ fontFamily: "inherit" }}
      >
        {step}
      </text>
    </g>
  );
}

function BranchSplit({
  branches,
  topWidth,
  centerX,
  y,
}: {
  branches: EngagementFunnelBranch[];
  topWidth: number;
  centerX: number;
  y: number;
}) {
  const total = branches.reduce((s, b) => s + b.value, 0) || 1;
  const branchWidths = branches.map((b) =>
    b.value > 0 ? Math.max((b.value / total) * topWidth, 44) : 32
  );
  const totalW = branchWidths.reduce((s, w) => s + w, 0);
  let xCursor = -totalW / 2;

  return (
    <g transform={`translate(${centerX}, ${y})`}>
      {branches.map((branch, i) => {
        const w = branchWidths[i];
        const cx = xCursor + w / 2;
        const points = `${xCursor},0 ${xCursor + w},0 ${cx},${BRANCH_HEIGHT}`;
        const g = (
          <g key={branch.label}>
            <polygon points={points} fill={branchColor(i)} />
            <text
              x={cx}
              y={BRANCH_HEIGHT * 0.55}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={13}
              fontWeight={700}
              style={{ fontFamily: "inherit" }}
            >
              {branch.value}
            </text>
            <text
              x={cx}
              y={BRANCH_HEIGHT + 14}
              textAnchor="middle"
              fill="hsl(var(--muted-foreground))"
              fontSize={11}
              fontWeight={500}
              style={{ fontFamily: "inherit" }}
            >
              {branch.label}
            </text>
          </g>
        );
        xCursor += w;
        return g;
      })}
    </g>
  );
}

export function EngagementFunnelChart({
  stages,
  branches,
  className,
}: {
  stages: EngagementFunnelStage[];
  branches?: EngagementFunnelBranch[];
  className?: string;
}) {
  if (stages.length === 0 || stages[0].value === 0) {
    return null;
  }

  const values = stages.map((s) => s.value);
  const widths = segmentWidths(values);
  const funnelCenterX = LABEL_WIDTH + MAX_FUNNEL_WIDTH / 2 + 20;
  const stepX = funnelCenterX + MAX_FUNNEL_WIDTH / 2 + STEP_COL_WIDTH;
  const hasBranches = branches && branches.some((b) => b.value > 0);

  const linearHeight =
    stages.length * STAGE_HEIGHT + Math.max(0, stages.length - 1) * STAGE_GAP;
  const branchBlockHeight = hasBranches ? BRANCH_HEIGHT + STAGE_GAP + 16 : 0;
  const svgHeight = linearHeight + branchBlockHeight + 8;

  const lastStageWidth = widths[widths.length - 1];

  return (
    <div className={cn("w-full space-y-4", className)}>
      <svg
        viewBox={`0 0 ${stepX + STEP_COL_WIDTH} ${svgHeight}`}
        className="mx-auto h-auto w-full max-w-[480px]"
        role="img"
        aria-label="Funil de conversão"
      >
        {stages.map((stage, index) => {
          const topWidth = widths[index];
          const bottomWidth =
            index < stages.length - 1
              ? widths[index + 1]
              : hasBranches
                ? lastStageWidth
                : 0;
          const isLastLinear = index === stages.length - 1 && !hasBranches;
          const segmentY = index * (STAGE_HEIGHT + STAGE_GAP);
          const labelY = segmentY + STAGE_HEIGHT / 2;
          const color = stageColor(index, stages.length);

          return (
            <g key={stage.step}>
              <text
                x={LABEL_WIDTH - 8}
                y={labelY - 8}
                textAnchor="end"
                fill="hsl(var(--foreground))"
                fontSize={13}
                fontWeight={500}
                style={{ fontFamily: "inherit" }}
              >
                {stage.label}
              </text>
              <text
                x={LABEL_WIDTH - 8}
                y={labelY + 12}
                textAnchor="end"
                fill="hsl(var(--primary))"
                fontSize={14}
                fontWeight={700}
                style={{ fontFamily: "inherit" }}
              >
                {stage.pct}%
              </text>
              <g transform={`translate(${funnelCenterX}, ${segmentY})`}>
                <TrapezoidShape
                  topWidth={topWidth}
                  bottomWidth={isLastLinear ? 0 : bottomWidth}
                  height={STAGE_HEIGHT}
                  fill={color}
                  value={stage.value}
                  isTriangle={isLastLinear}
                />
              </g>
              <g transform={`translate(${stepX}, 0)`}>
                <StepBadge step={stage.step} y={labelY} />
              </g>
            </g>
          );
        })}

        {hasBranches && branches && (
          <BranchSplit
            branches={branches}
            topWidth={lastStageWidth}
            centerX={funnelCenterX}
            y={linearHeight}
          />
        )}
      </svg>

      {branches && branches.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Métricas de conversão
          </p>
          <div className="grid grid-cols-3 gap-2">
            {branches.map((branch) => (
              <div
                key={branch.label}
                className="rounded-md bg-background px-3 py-2 text-center shadow-sm"
              >
                <p className="text-xs text-muted-foreground">{branch.label}</p>
                <p className="text-lg font-bold tabular-nums text-primary">
                  {branch.pct}%
                </p>
                <p className="text-xs text-muted-foreground">{branch.value} consultas</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
