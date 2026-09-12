import { polygonToPath } from "@/features/map/layers/polygonPath";
import { mapVar } from "@/features/map/mapTheme";

import type { MapFeature } from "@/domain/schema";

export function HardscapeLayer({ features }: { features: MapFeature[] }) {
  const plazas = features.filter((f) => f.layer === "plaza" && f.geometry.type === "Polygon");
  const walkways = features.filter((f) => f.layer === "walkway");
  return (
    <g>
      {plazas.map((f) =>
        f.geometry.type === "Polygon" ? (
          <path
            key={f.id}
            d={polygonToPath(f.geometry)}
            fill={mapVar.plaza}
            stroke={mapVar.walkwayEdge}
            strokeWidth={0.4}
          />
        ) : null,
      )}
      {walkways.map((f) => {
        if (f.geometry.type !== "LineString") return null;
        const width = f.geometry.widthM ?? 3;
        return (
          <polyline
            key={f.id}
            points={f.geometry.coordinates.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke={mapVar.walkway}
            strokeWidth={width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </g>
  );
}
