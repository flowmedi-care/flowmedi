"use client";

import { cn } from "@/lib/utils";
import type { CumulativeFunnelStage } from "@/app/dashboard/crm/pipeline-actions";

export type EngagementFunnelStage = CumulativeFunnelStage;

const STAGE_HEIGHT_DEFAULT = 56;
const STAGE_HEIGHT_COMPACT = 46;
const STAGE_GAP = 5;
const MAX_FUNNEL_WIDTH = 240;
const MIN_SEGMENT_WIDTH = 48;
const LABEL_WIDTH = 130;
const STEP_COL_WIDTH = 36;

function stageColor(index: number, total: number): string {
  const startHue = 158;
  const startLight = 72;
  const endLight = 38;
  const t = total <= 1 ? 0 : index / (total - 1);
  const lightness = startLight - t * (startLight - endLight);
  const saturation = 55 + t * 15;
  return `hsl(${startHue} ${saturation}% ${lightness}%)`;
}

function segmentWidths(values: number[]): number[] {
  const top = values[0] ?? 1;
  const max = Math.max(top, 1);
  return values.map((v) =>
    Math.max((v / max) * MAX_FUNNEL_WIDTH, v > 0 ? MIN_SEGMENT_WIDTH : MIN_SEGMENT_WIDTH * 0.45)
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

export function EngagementFunnelChart({
  stages,
  className,
}: {
  stages: EngagementFunnelStage[];
  className?: string;
}) {
  if (stages.length === 0 || stages[0].value === 0) {
    return null;
  }

  const stageHeight =
    stages.length > 4 ? STAGE_HEIGHT_COMPACT : STAGE_HEIGHT_DEFAULT;
  const values = stages.map((s) => s.value);
  const widths = segmentWidths(values);
  const funnelCenterX = LABEL_WIDTH + MAX_FUNNEL_WIDTH / 2 + 20;
  const stepX = funnelCenterX + MAX_FUNNEL_WIDTH / 2 + STEP_COL_WIDTH;
  const svgHeight =
    stages.length * stageHeight + Math.max(0, stages.length - 1) * STAGE_GAP + 8;

  return (
    <div className={cn("w-full py-2", className)}>
      <svg
        viewBox={`0 0 ${stepX + STEP_COL_WIDTH} ${svgHeight}`}
        className="mx-auto h-auto w-full max-w-[480px]"
        role="img"
        aria-label="Funil de conversão"
      >
        {stages.map((stage, index) => {
          const topWidth = widths[index];
          const bottomWidth =
            index < stages.length - 1 ? widths[index + 1] : 0;
          const isLast = index === stages.length - 1;
          const segmentY = index * (stageHeight + STAGE_GAP);
          const labelY = segmentY + stageHeight / 2;
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
                  bottomWidth={isLast ? 0 : bottomWidth}
                  height={stageHeight}
                  fill={color}
                  value={stage.value}
                  isTriangle={isLast}
                />
              </g>
              <g transform={`translate(${stepX}, 0)`}>
                <StepBadge step={stage.step} y={labelY} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
