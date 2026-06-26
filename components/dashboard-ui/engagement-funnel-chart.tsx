"use client";

import { cn } from "@/lib/utils";
import type {
  CumulativeFunnelStage,
  FunnelOutcomeBranch,
} from "@/app/dashboard/crm/pipeline-actions";

export type EngagementFunnelStage = CumulativeFunnelStage;
export type EngagementFunnelBranch = FunnelOutcomeBranch;

const STAGE_HEIGHT = 56;
const STAGE_GAP = 8;
const OUTCOME_GAP = 10;
const CONNECTOR_HEIGHT = 20;
const OUTCOME_BOX_HEIGHT = 54;
const MAX_FUNNEL_WIDTH = 240;
const MIN_SEGMENT_WIDTH = 56;
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

const OUTCOME_COLORS = [
  "hsl(38 85% 52%)",
  "hsl(158 55% 42%)",
  "hsl(0 55% 52%)",
];

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

function StageLabels({
  stage,
  labelY,
}: {
  stage: EngagementFunnelStage;
  labelY: number;
}) {
  return (
    <>
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
    </>
  );
}

function outcomeBoxWidths(
  branches: EngagementFunnelBranch[],
  totalSpread: number
): number[] {
  const centerMin = 96;
  const sideMin = 56;
  const [left, center, right] = branches;
  const sum = left.value + center.value + right.value || 1;

  let centerW = Math.max((center.value / sum) * totalSpread * 0.55, centerMin);
  let leftW = Math.max((left.value / sum) * totalSpread * 0.225, sideMin);
  let rightW = Math.max((right.value / sum) * totalSpread * 0.225, sideMin);

  const totalW = leftW + centerW + rightW + OUTCOME_GAP * 2;
  if (totalW > totalSpread + 20) {
    const scale = (totalSpread + 20) / totalW;
    leftW *= scale;
    centerW *= scale;
    rightW *= scale;
  }

  return [leftW, centerW, rightW];
}

function SplitBottomFunnel({
  stages,
  branches,
  className,
}: {
  stages: EngagementFunnelStage[];
  branches: EngagementFunnelBranch[];
  className?: string;
}) {
  const linearStages = stages.slice(0, 2);
  const values = linearStages.map((s) => s.value);
  const widths = segmentWidths(values);
  const funnelCenterX = LABEL_WIDTH + MAX_FUNNEL_WIDTH / 2 + 20;
  const stepX = funnelCenterX + MAX_FUNNEL_WIDTH / 2 + STEP_COL_WIDTH;

  const [leftW, centerW, rightW] = outcomeBoxWidths(branches, MAX_FUNNEL_WIDTH + 40);
  const outcomesTotalW = leftW + centerW + rightW + OUTCOME_GAP * 2;
  const outcomesStartX = funnelCenterX - outcomesTotalW / 2;

  const linearHeight = 2 * STAGE_HEIGHT + STAGE_GAP;
  const outcomesY = linearHeight + CONNECTOR_HEIGHT;
  const svgHeight = outcomesY + OUTCOME_BOX_HEIGHT + 36;

  const confirmBottomY = STAGE_HEIGHT + STAGE_GAP + STAGE_HEIGHT;
  const confirmBottomHalf = widths[1] / 2;

  const leftBoxX = outcomesStartX;
  const centerBoxX = leftBoxX + leftW + OUTCOME_GAP;
  const rightBoxX = centerBoxX + centerW + OUTCOME_GAP;

  const leftBoxTop = { x: leftBoxX + leftW / 2, y: outcomesY };
  const centerBoxTop = { x: centerBoxX + centerW / 2, y: outcomesY };
  const rightBoxTop = { x: rightBoxX + rightW / 2, y: outcomesY };
  const confirmBottom = { x: funnelCenterX, y: confirmBottomY };

  return (
    <div className={cn("w-full py-2", className)}>
      <svg
        viewBox={`0 0 ${stepX + STEP_COL_WIDTH} ${svgHeight}`}
        className="mx-auto h-auto w-full max-w-[500px]"
        role="img"
        aria-label="Funil de comparecimento"
      >
        {linearStages.map((stage, index) => {
          const topWidth = widths[index];
          const bottomWidth = index === 0 ? widths[1] : widths[1];
          const segmentY = index * (STAGE_HEIGHT + STAGE_GAP);
          const labelY = segmentY + STAGE_HEIGHT / 2;

          return (
            <g key={stage.step}>
              <StageLabels stage={stage} labelY={labelY} />
              <g transform={`translate(${funnelCenterX}, ${segmentY})`}>
                <TrapezoidShape
                  topWidth={topWidth}
                  bottomWidth={bottomWidth}
                  height={STAGE_HEIGHT}
                  fill={stageColor(index, 2)}
                  value={stage.value}
                />
              </g>
              <g transform={`translate(${stepX}, 0)`}>
                <StepBadge step={stage.step} y={labelY} />
              </g>
            </g>
          );
        })}

        <g
          stroke="hsl(var(--border))"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        >
          <line
            x1={confirmBottom.x}
            y1={confirmBottom.y}
            x2={centerBoxTop.x}
            y2={centerBoxTop.y}
          />
          <line
            x1={confirmBottom.x - confirmBottomHalf * 0.6}
            y1={confirmBottom.y}
            x2={leftBoxTop.x}
            y2={leftBoxTop.y}
          />
          <line
            x1={confirmBottom.x + confirmBottomHalf * 0.6}
            y1={confirmBottom.y}
            x2={rightBoxTop.x}
            y2={rightBoxTop.y}
          />
        </g>

        {branches.map((branch, i) => {
          const boxX = [leftBoxX, centerBoxX, rightBoxX][i];
          const boxW = [leftW, centerW, rightW][i];
          return (
            <g key={branch.label}>
              <rect
                x={boxX}
                y={outcomesY}
                width={boxW}
                height={OUTCOME_BOX_HEIGHT}
                rx={8}
                fill={OUTCOME_COLORS[i]}
              />
              <text
                x={boxX + boxW / 2}
                y={outcomesY + OUTCOME_BOX_HEIGHT / 2 - 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={15}
                fontWeight={700}
                style={{ fontFamily: "inherit" }}
              >
                {branch.value}
              </text>
              <text
                x={boxX + boxW / 2}
                y={outcomesY + OUTCOME_BOX_HEIGHT + 16}
                textAnchor="middle"
                fill="hsl(var(--foreground))"
                fontSize={12}
                fontWeight={600}
                style={{ fontFamily: "inherit" }}
              >
                {branch.label}
              </text>
              <text
                x={boxX + boxW / 2}
                y={outcomesY + OUTCOME_BOX_HEIGHT + 30}
                textAnchor="middle"
                fill="hsl(var(--primary))"
                fontSize={12}
                fontWeight={700}
                style={{ fontFamily: "inherit" }}
              >
                {branch.pct}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
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

  if (branches && branches.length === 3) {
    return (
      <SplitBottomFunnel stages={stages} branches={branches} className={className} />
    );
  }

  const stageHeight = stages.length > 4 ? 46 : STAGE_HEIGHT;
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

          return (
            <g key={stage.step}>
              <StageLabels stage={stage} labelY={labelY} />
              <g transform={`translate(${funnelCenterX}, ${segmentY})`}>
                <TrapezoidShape
                  topWidth={topWidth}
                  bottomWidth={isLast ? 0 : bottomWidth}
                  height={stageHeight}
                  fill={stageColor(index, stages.length)}
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
