"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useState } from "react";
import { computeOrthogonalPath } from "@/lib/virtual-assistant/agent-pipeline/edge-routing";
import type { EdgeRoutingMode } from "@/lib/virtual-assistant/agent-pipeline/swimlane-layout";

export type TriggerEdgeData = {
  routing?: EdgeRoutingMode;
  label?: string;
  triggerType?: string;
  highlighted?: boolean;
  showLabelAlways?: boolean;
};

const TRIGGER_PREFIX: Record<string, string> = {
  intent: "intent",
  journey_step: "journey",
  ai_state: "state",
  tool_result: "tool",
  human_action: "ação",
  timeout: "timeout",
  parallel: "∥",
  resolver: "resolver",
};

const KNOWN_PREFIXES = new Set(Object.values(TRIGGER_PREFIX));

function hasKnownPrefix(label: string): boolean {
  const lower = label.toLowerCase();
  for (const p of KNOWN_PREFIXES) {
    if (lower.startsWith(`${p}:`) || lower.startsWith(`${p} `)) return true;
  }
  return false;
}

function formatTriggerLabel(label?: string, triggerType?: string): string | undefined {
  if (!label) return undefined;
  if (hasKnownPrefix(label)) return label;
  const prefix = triggerType ? TRIGGER_PREFIX[triggerType] : undefined;
  if (prefix) return `${prefix}: ${label}`;
  return label;
}

export function OrthogonalEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style,
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const edgeData = data as TriggerEdgeData | undefined;
  const routing = edgeData?.routing ?? "direct";
  const edgePath = computeOrthogonalPath(sourceX, sourceY, targetX, targetY, routing, source, target);

  const [, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });

  const displayLabel = formatTriggerLabel(
    typeof label === "string" ? label : edgeData?.label,
    edgeData?.triggerType
  );

  const showLabel =
    !!displayLabel &&
    (edgeData?.showLabelAlways || edgeData?.highlighted || hovered);

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="react-flow__edge-interaction"
      />
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
              fontSize: 9,
              fontWeight: 500,
              color: "#475569",
              ...(labelStyle as object),
              background: (labelBgStyle as { fill?: string })?.fill ?? "hsl(var(--background))",
              opacity: (labelBgStyle as { fillOpacity?: number })?.fillOpacity ?? 0.95,
              padding: labelBgPadding ? `${labelBgPadding[1]}px ${labelBgPadding[0]}px` : "4px 6px",
              borderRadius: labelBgBorderRadius ?? 4,
            }}
            className="nodrag nopan max-w-[140px] truncate"
            title={displayLabel}
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
