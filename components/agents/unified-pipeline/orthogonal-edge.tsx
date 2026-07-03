"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { computeOrthogonalPath } from "@/lib/virtual-assistant/agent-pipeline/edge-routing";
import type { EdgeRoutingMode } from "@/lib/virtual-assistant/agent-pipeline/pool-layout";

export type OrthogonalEdgeData = {
  routing?: EdgeRoutingMode;
  label?: string;
};

export function OrthogonalEdge({
  id,
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
  const routing = (data as OrthogonalEdgeData | undefined)?.routing ?? "direct";
  const edgePath = computeOrthogonalPath(sourceX, sourceY, targetX, targetY, routing);

  const [, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const displayLabel = label ?? (data as OrthogonalEdgeData | undefined)?.label;

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
              padding: labelBgPadding
                ? `${labelBgPadding[1]}px ${labelBgPadding[0]}px`
                : "4px 6px",
              borderRadius: labelBgBorderRadius ?? 4,
            }}
            className="nodrag nopan"
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
