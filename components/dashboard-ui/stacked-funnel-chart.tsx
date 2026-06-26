"use client";

import { cn } from "@/lib/utils";

export type StackedFunnelStage = {
  label: string;
  value: number;
  color: string;
};

const FUNNEL_STAGE_HEIGHT = 52;
const FUNNEL_GAP = 4;
const FUNNEL_MAX_WIDTH = 220;
const FUNNEL_MIN_WIDTH = 48;
const LABEL_COLUMN_WIDTH = 100;

function stageWidths(stages: StackedFunnelStage[]): number[] {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return stages.map((s) => {
    if (s.value <= 0) return FUNNEL_MIN_WIDTH * 0.55;
    return Math.max((s.value / max) * FUNNEL_MAX_WIDTH, FUNNEL_MIN_WIDTH);
  });
}

function TrapezoidSegment({
  topWidth,
  bottomWidth,
  height,
  color,
  value,
  isLast,
}: {
  topWidth: number;
  bottomWidth: number;
  height: number;
  color: string;
  value: number;
  isLast: boolean;
}) {
  const halfTop = topWidth / 2;
  const halfBottom = bottomWidth / 2;

  const points = isLast
    ? `${-halfTop},0 ${halfTop},0 0,${height}`
    : `${-halfTop},0 ${halfTop},0 ${halfBottom},${height} ${-halfBottom},${height}`;

  return (
    <g>
      <polygon points={points} fill={color} />
      <text
        y={isLast ? height * 0.62 : height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-white text-[15px] font-bold"
        style={{ fontFamily: "inherit" }}
      >
        {value}
      </text>
    </g>
  );
}

export function StackedFunnelChart({
  stages,
  className,
}: {
  stages: StackedFunnelStage[];
  className?: string;
}) {
  const widths = stageWidths(stages);
  const totalHeight =
    stages.length * FUNNEL_STAGE_HEIGHT + Math.max(0, stages.length - 1) * FUNNEL_GAP;

  const funnelCenterX = LABEL_COLUMN_WIDTH + FUNNEL_MAX_WIDTH / 2 + 16;
  const svgWidth = funnelCenterX + FUNNEL_MAX_WIDTH / 2 + 24;

  return (
    <div className={cn("w-full py-2", className)}>
      <svg
        viewBox={`0 0 ${svgWidth} ${totalHeight + 8}`}
        className="mx-auto h-auto w-full max-w-[440px]"
        role="img"
        aria-label="Gráfico de funil"
      >
        {stages.map((stage, index) => {
          const topWidth = widths[index];
          const bottomWidth =
            index < stages.length - 1 ? widths[index + 1] : 0;
          const isLast = index === stages.length - 1;
          const segmentY =
            index * (FUNNEL_STAGE_HEIGHT + FUNNEL_GAP);
          const labelY = segmentY + FUNNEL_STAGE_HEIGHT / 2 + 4;

          return (
            <g key={stage.label}>
              <text
                x={LABEL_COLUMN_WIDTH}
                y={labelY}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[13px] font-medium"
                style={{ fontFamily: "inherit" }}
              >
                {stage.label}
              </text>
              <g transform={`translate(${funnelCenterX}, ${segmentY})`}>
                <TrapezoidSegment
                  topWidth={topWidth}
                  bottomWidth={bottomWidth}
                  height={FUNNEL_STAGE_HEIGHT}
                  color={stage.color}
                  value={stage.value}
                  isLast={isLast}
                />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Paleta fixa no estilo funil clássico (amarelo → cinza) */
export const FUNNEL_CLASSIC_COLORS = [
  "#F5B700",
  "#F28C28",
  "#3CB371",
  "#4A90D9",
  "#8E99A4",
  "#9B59B6",
] as const;
