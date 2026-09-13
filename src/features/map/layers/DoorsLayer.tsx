import { DoorOpen } from "lucide-react";

import { buildingTint } from "@/features/map/mapTheme";

import type { Building, GraphNode } from "@/domain/schema";

/**
 * Marks every entrance/door node as a small door glyph, tinted to match its
 * building. Rendered after `BuildingsLayer` (see `CampusMap.tsx`'s layer
 * order) so a door sitting exactly on a building's outline is drawn on top
 * of the building fill instead of being swallowed by it. "door" and
 * "entrance" are both real building openings in the traced data (the
 * distinction is just how the user's editor session labeled a given node),
 * so both kinds get the same glyph.
 */
export function DoorsLayer({
  nodes,
  buildingsById,
  scale,
}: {
  nodes: GraphNode[];
  buildingsById: Map<string, Building>;
  scale: number;
}) {
  const doors = nodes.filter((n) => n.kind === "door" || n.kind === "entrance");
  const s = 1 / scale;

  return (
    <g>
      {doors.map((node) => {
        const building = node.buildingId ? buildingsById.get(node.buildingId) : undefined;
        const tint = building ? buildingTint(building.id, building.category) : "#334155";
        return (
          <g key={node.id} transform={`translate(${node.x} ${node.y}) scale(${s})`} pointerEvents="none">
            <circle r={7.5} fill="white" stroke={tint} strokeWidth={2} />
            <DoorOpen x={-5} y={-5} width={10} height={10} stroke={tint} strokeWidth={2.5} fill="none" />
          </g>
        );
      })}
    </g>
  );
}
