import {
  CORRIDORS,
  type EdgeRoutingMode,
  getNodeBounds,
  getNodeLane,
  LANE_Y,
  NODE_LAYOUT,
} from "./swimlane-layout";

function segIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const pad = 8;
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  if (maxX < rx - pad || minX > rx + rw + pad || maxY < ry - pad || minY > ry + rh + pad) return false;
  return true;
}

/** Gera path SVG ortogonal com suporte cross-lane e switch fan */
export function computeOrthogonalPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  routing: EdgeRoutingMode,
  sourceId?: string,
  targetId?: string
): string {
  const points: [number, number][] = [[sourceX, sourceY]];

  switch (routing) {
    case "direct":
      if (Math.abs(sourceY - targetY) < 8) points.push([targetX, targetY]);
      else {
        const midX = (sourceX + targetX) / 2;
        points.push([midX, sourceY], [midX, targetY], [targetX, targetY]);
      }
      break;
    case "vertical-down":
    case "vertical-up":
      points.push([sourceX, targetY], [targetX, targetY]);
      break;
    case "bus-bottom":
      points.push([sourceX, CORRIDORS.mainBusY], [targetX, CORRIDORS.mainBusY], [targetX, targetY]);
      break;
    case "bus-top":
      points.push([sourceX, CORRIDORS.loopY], [targetX, CORRIDORS.loopY], [targetX, targetY]);
      break;
    case "bus-escalation":
      points.push([sourceX, CORRIDORS.escalationY], [targetX, CORRIDORS.escalationY], [targetX, targetY]);
      break;
    case "loop":
      points.push([sourceX, CORRIDORS.loopY], [targetX, CORRIDORS.loopY], [targetX, targetY]);
      break;
    case "cross-lane": {
      const fl = sourceId ? getNodeLane(sourceId) : null;
      const tl = targetId ? getNodeLane(targetId) : null;
      const corridorY =
        fl && tl ? CORRIDORS.betweenLanes(fl, tl) : (sourceY + targetY) / 2;
      points.push([sourceX, corridorY], [targetX, corridorY], [targetX, targetY]);
      break;
    }
    case "switch-fan":
      points.push([sourceX + 60, sourceY], [sourceX + 60, targetY], [targetX, targetY]);
      break;
    default:
      points.push([targetX, targetY]);
  }

  let path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");

  if (sourceId && targetId) {
    path = nudgePathAwayFromNodes(points, sourceId, targetId);
  }

  return path;
}

function nudgePathAwayFromNodes(
  points: [number, number][],
  sourceId: string,
  targetId: string
): string {
  const skip = new Set([sourceId, targetId]);
  let nudged = [...points];
  for (let iter = 0; iter < 3; iter++) {
    let hit = false;
    for (const [nodeId] of Object.entries(NODE_LAYOUT)) {
      if (skip.has(nodeId) || nodeId.startsWith("swimlane_")) continue;
      const b = getNodeBounds(nodeId);
      if (!b) continue;
      for (let i = 0; i < nudged.length - 1; i++) {
        const [x1, y1] = nudged[i]!;
        const [x2, y2] = nudged[i + 1]!;
        if (segIntersectsRect(x1, y1, x2, y2, b.x, b.y, b.w, b.h)) {
          hit = true;
          if (Math.abs(y2 - y1) < 2) {
            nudged[i + 1] = [x2, y2 + 24];
          } else {
            nudged.splice(i + 1, 0, [x1, y1 + 24], [x2, y1 + 24]);
          }
          break;
        }
      }
      if (hit) break;
    }
    if (!hit) break;
  }
  return nudged.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
}

export { LANE_Y, CORRIDORS };
