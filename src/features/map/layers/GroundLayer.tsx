import { polygonToPath } from "@/features/map/layers/polygonPath";
import { mapVar } from "@/features/map/mapTheme";

import type { MapFeature } from "@/domain/schema";

export function GroundLayer({
  bounds,
  features,
}: {
  bounds: { width: number; height: number };
  features: MapFeature[];
}) {
  const futureZones = features.filter((f) => f.layer === "future_zone");
  return (
    <g>
      <rect x={0} y={0} width={bounds.width} height={bounds.height} fill={mapVar.ground} />
      {futureZones.map((f) =>
        f.geometry.type === "Polygon" ? (
          <path
            key={f.id}
            d={polygonToPath(f.geometry)}
            fill={mapVar.future}
            stroke={mapVar.walkwayEdge}
            strokeWidth={0.6}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        ) : null,
      )}
    </g>
  );
}
