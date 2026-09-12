import { mapVar } from "@/features/map/mapTheme";

import type { MapFeature } from "@/domain/schema";

export function CanopiesLayer({ features }: { features: MapFeature[] }) {
  const canopies = features.filter((f) => f.layer === "canopy" && f.geometry.type === "Point");
  return (
    <g>
      {canopies.map((f) => {
        if (f.geometry.type !== "Point") return null;
        const [x, y] = f.geometry.coordinates;
        const radius = f.variant === "round" ? 8 : 6;
        return (
          <circle
            key={f.id}
            cx={x}
            cy={y}
            r={radius}
            fill={mapVar.canopy}
            opacity={0.6}
            stroke={mapVar.walkwayEdge}
            strokeWidth={0.3}
          />
        );
      })}
    </g>
  );
}
