import { polygonToPath } from "@/features/map/layers/polygonPath";
import { mapVar } from "@/features/map/mapTheme";

import type { MapFeature } from "@/domain/schema";

export function RoadsLayer({ features }: { features: MapFeature[] }) {
  const roads = features.filter((f) => f.layer === "road" && f.geometry.type === "Polygon");
  const markings = features.filter((f) => f.layer === "road_marking" && f.geometry.type === "LineString");
  return (
    <g>
      {roads.map((f) =>
        f.geometry.type === "Polygon" ? (
          <path key={f.id} d={polygonToPath(f.geometry)} fill={mapVar.road} fillRule="evenodd" />
        ) : null,
      )}
      {markings.map((f) => {
        if (f.geometry.type !== "LineString") return null;
        return (
          <polyline
            key={f.id}
            points={f.geometry.coordinates.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke={mapVar.roadMarking}
            strokeWidth={0.6}
            strokeDasharray="3 2.5"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
}
