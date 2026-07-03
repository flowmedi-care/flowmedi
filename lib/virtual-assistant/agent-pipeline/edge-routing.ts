import { CORRIDORS, type EdgeRoutingMode } from "./pool-layout";

/** Gera path SVG ortogonal — segmentos só em corredores reservados */
export function computeOrthogonalPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  routing: EdgeRoutingMode
): string {
  const points: [number, number][] = [[sourceX, sourceY]];

  switch (routing) {
    case "direct": {
      if (Math.abs(sourceY - targetY) < 8) {
        points.push([targetX, targetY]);
      } else {
        const midX = (sourceX + targetX) / 2;
        points.push([midX, sourceY], [midX, targetY], [targetX, targetY]);
      }
      break;
    }
    case "vertical-down":
    case "vertical-up": {
      points.push([sourceX, targetY], [targetX, targetY]);
      break;
    }
    case "bus-bottom": {
      const busY = CORRIDORS.mainBusY;
      points.push([sourceX, busY], [targetX, busY], [targetX, targetY]);
      break;
    }
    case "bus-top": {
      const busY = sourceY - 60;
      points.push([sourceX, busY], [targetX, busY], [targetX, targetY]);
      break;
    }
    case "bus-escalation": {
      const busY = CORRIDORS.escalationY;
      if (Math.abs(sourceY - busY) > 8) points.push([sourceX, busY]);
      if (Math.abs(sourceX - targetX) > 8) points.push([targetX, busY]);
      points.push([targetX, targetY]);
      break;
    }
    case "loop": {
      const loopY = CORRIDORS.loopY;
      points.push([sourceX, loopY], [targetX, loopY], [targetX, targetY]);
      break;
    }
    default:
      points.push([targetX, targetY]);
  }

  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
}
