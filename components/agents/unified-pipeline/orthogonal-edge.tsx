"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { computeOrthogonalPath } from "@/lib/virtual-assistant/agent-pipeline/edge-routing";
import type { EdgeRoutingMode } from "@/lib/virtual-assistant/agent-pipeline/swimlane-layout";

export type TriggerEdgeData = {
  routing?: EdgeRoutingMode;
  label?: string;
  triggerType?: string;
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

function formatTriggerLabel(label?: string, triggerType?: string): string | undefined {
  if (!label) return undefined;
  const prefix = triggerType ? TRIGGER_PREFIX[triggerType] : undefined;
  if (prefix && !label.startsWith(prefix)) return `${prefix}: ${label}`;
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
  const edgeData = data as TriggerEdgeData | undefined;
  const routing = edgeData?.routing ?? "direct";
  const edgePath = computeOrthogonalPath(sourceX, sourceY, targetX, targetY, routing, source, target);

  const [, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });

  const displayLabel = formatTriggerLabel(
    typeof label === "string" ? label : edgeData?.label,
    edgeData?.triggerType
  );

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {displayLabel && (
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
            className="nodrag nopan max-w-[120px] truncate"
            title={displayLabel}
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
