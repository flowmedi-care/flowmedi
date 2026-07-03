"use client";

import { Handle, Position } from "@xyflow/react";

/** Nó invisível para rotear arestas longas sem cruzar cards. */
export function RouteAnchorNode() {
  return (
    <div className="h-px w-px opacity-0 pointer-events-none">
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Top} id="top-src" />
    </div>
  );
}
