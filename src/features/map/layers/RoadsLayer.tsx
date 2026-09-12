import { polygonToPath } from "@/features/map/layers/polygonPath";
import { mapVar } from "@/features/map/mapTheme";

import type { MapFeature } from "@/domain/schema";

export function RoadsLayer({ features }: { features: MapFeature[] }) {
  const roads = features.filter((f) => f.layer === "road" && f.geometry.type === "Polygon");
  return (
    <g>
      {roads.map((f) =>
        f.geometry.type === "Polygon" ? (
          <path key={f.id} d={polygonToPath(f.geometry)} fill={mapVar.road} fillRule="evenodd" />
        ) : null,
      )}
    </g>
  );
}
