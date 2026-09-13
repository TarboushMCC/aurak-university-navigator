import { findShortestPath } from "@/domain/routing/astar";

import type { CampusBundle } from "@/domain/schema";
import type { Point } from "@/domain/geometry/vector";

export interface PlannedRoute {
  nodeIds: string[];
  points: Point[];
  distanceM: number;
  durationS: number;
  /** Buildings the route actually touches (via anchor nodes), for dimming everything else on the map. */
  buildingIds: string[];
}

/**
 * Plans the shortest walking route between two places, trying every
 * combination of their anchor nodes (most places have exactly one, but a
 * place could have several entrances) and keeping the shortest result.
 * Returns null if either place has no walkway anchor yet, or no path
 * connects them (a disconnected part of the graph).
 */
export function planRoute(bundle: CampusBundle, fromPlaceId: string, toPlaceId: string): PlannedRoute | null {
  const fromPlace = bundle.places.find((p) => p.id === fromPlaceId);
  const toPlace = bundle.places.find((p) => p.id === toPlaceId);
  if (!fromPlace || !toPlace || fromPlace.anchors.length === 0 || toPlace.anchors.length === 0) return null;

  let best: { nodeIds: string[]; distanceM: number } | null = null;
  for (const startAnchor of fromPlace.anchors) {
    for (const endAnchor of toPlace.anchors) {
      const result = findShortestPath(bundle.nodes, bundle.edges, startAnchor, endAnchor);
      if (result && (!best || result.distanceM < best.distanceM)) best = result;
    }
  }
  if (!best) return null;

  const nodeById = new Map(bundle.nodes.map((n) => [n.id, n]));
  const points: Point[] = best.nodeIds.map((id) => {
    const n = nodeById.get(id)!;
    return [n.x, n.y];
  });
  const buildingIds = [...new Set(best.nodeIds.map((id) => nodeById.get(id)?.buildingId).filter((id): id is string => Boolean(id)))];
  const walkingSpeedMps = bundle.campus.walkingSpeedMps.default;

  return {
    nodeIds: best.nodeIds,
    points,
    distanceM: best.distanceM,
    durationS: best.distanceM / walkingSpeedMps,
    buildingIds,
  };
}
