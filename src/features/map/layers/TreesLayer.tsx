import { mapVar } from "@/features/map/mapTheme";

import type { MapFeature } from "@/domain/schema";

export function TreesLayer({ features, scale }: { features: MapFeature[]; scale: number }) {
  const trees = features.filter((f) => f.layer === "tree" && f.geometry.type === "Point");
  // Thin out at low zoom so the canopy doesn't turn into noise (PLAN §4.4 item 9).
  if (scale < 0.5) return null;
  const radius = scale < 1 ? 1.6 : 2.2;
  return (
    <g>
      {trees.map((f) => {
        if (f.geometry.type !== "Point") return null;
        const [x, y] = f.geometry.coordinates;
        return (
          <circle
            key={f.id}
            cx={x}
            cy={y}
            r={radius}
            fill={mapVar.treeCanopy}
            stroke={mapVar.tree}
            strokeWidth={0.3}
          />
        );
      })}
    </g>
  );
}
