import { mapVar } from "@/features/map/mapTheme";

import type { GraphEdge, GraphNode } from "@/domain/schema";

/**
 * Renders the walkway graph as real paved paths (docs/PLAN.md §4.4: "white
 * with a hairline edge") — this is the network's only visual footprint,
 * since no `MapFeature`s of layer "walkway" were traced (the graph itself
 * *is* the path data). Earlier this drew the raw graph for review, with a
 * colored dot per node; now that routing is built and verified, showing
 * every node kind as a colored dot only reads as clutter to a real user, so
 * this draws the edges as paving and nothing else.
 */
export function WalkwayLayer({ nodes, edges, dimmed }: { nodes: GraphNode[]; edges: GraphEdge[]; dimmed?: boolean }) {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  return (
    <g opacity={dimmed ? 0.45 : 1}>
      {edges.map((e) => {
        const a = nodesById.get(e.from);
        const b = nodesById.get(e.to);
        if (!a || !b) return null;
        return (
          <line
            key={`${e.id}-casing`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={mapVar.walkwayEdge}
            strokeWidth={3.2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {edges.map((e) => {
        const a = nodesById.get(e.from);
        const b = nodesById.get(e.to);
        if (!a || !b) return null;
        return (
          <line
            key={`${e.id}-fill`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={mapVar.walkway}
            strokeWidth={1.8}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
}
