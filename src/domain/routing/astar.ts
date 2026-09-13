import type { GraphEdge, GraphNode } from "@/domain/schema";

export interface AstarResult {
  /** Node ids from start to end, inclusive. */
  nodeIds: string[];
  distanceM: number;
}

/**
 * Shortest walking path between two nodes in the walkway graph, weighted by
 * each edge's `lengthM` (straight-line metres, since walkways are traced as
 * straight segments between nodes). Uses the straight-line distance to the
 * goal as the A* heuristic — always an admissible underestimate of the real
 * walking distance, so the result is the true shortest path, not just "a"
 * path.
 */
export function findShortestPath(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startId: string,
  endId: string,
): AstarResult | null {
  if (startId === endId) {
    const node = nodes.find((n) => n.id === startId);
    return node ? { nodeIds: [startId], distanceM: 0 } : null;
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const start = nodeById.get(startId);
  const end = nodeById.get(endId);
  if (!start || !end) return null;

  const adjacency = new Map<string, { to: string; weight: number }[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) {
    const from = nodeById.get(e.from);
    const to = nodeById.get(e.to);
    if (!from || !to) continue;
    const weight = e.lengthM ?? Math.hypot(from.x - to.x, from.y - to.y);
    adjacency.get(e.from)?.push({ to: e.to, weight });
    if (e.bidirectional) adjacency.get(e.to)?.push({ to: e.from, weight });
  }

  const heuristic = (id: string) => {
    const n = nodeById.get(id)!;
    return Math.hypot(n.x - end.x, n.y - end.y);
  };

  const gScore = new Map<string, number>([[startId, 0]]);
  const cameFrom = new Map<string, string>();
  const openSet = new Set<string>([startId]);
  const fScore = new Map<string, number>([[startId, heuristic(startId)]]);

  while (openSet.size > 0) {
    let currentId: string | null = null;
    let currentF = Infinity;
    for (const id of openSet) {
      const f = fScore.get(id) ?? Infinity;
      if (f < currentF) {
        currentF = f;
        currentId = id;
      }
    }
    if (currentId === null) break;
    if (currentId === endId) {
      const nodeIds: string[] = [currentId];
      let cursor = currentId;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor)!;
        nodeIds.unshift(cursor);
      }
      return { nodeIds, distanceM: gScore.get(endId) ?? 0 };
    }

    openSet.delete(currentId);
    const currentG = gScore.get(currentId) ?? Infinity;
    for (const { to, weight } of adjacency.get(currentId) ?? []) {
      const tentativeG = currentG + weight;
      if (tentativeG < (gScore.get(to) ?? Infinity)) {
        cameFrom.set(to, currentId);
        gScore.set(to, tentativeG);
        fScore.set(to, tentativeG + heuristic(to));
        openSet.add(to);
      }
    }
  }

  return null;
}
