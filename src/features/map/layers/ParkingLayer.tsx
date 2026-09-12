import { polygonToPath } from "@/features/map/layers/polygonPath";
import { mapVar } from "@/features/map/mapTheme";

import type { MapFeature } from "@/domain/schema";

export function ParkingLayer({ features }: { features: MapFeature[] }) {
  const lots = features.filter((f) => f.layer === "parking" && f.geometry.type === "Polygon");
  return (
    <g>
      <defs>
        <pattern
          id="parking-hatch"
          patternUnits="userSpaceOnUse"
          width={6}
          height={6}
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={6} stroke={mapVar.walkwayEdge} strokeWidth={0.6} />
        </pattern>
      </defs>
      {lots.map((f) =>
        f.geometry.type === "Polygon" ? (
          <g key={f.id}>
            <path d={polygonToPath(f.geometry)} fill={mapVar.parking} />
            <path d={polygonToPath(f.geometry)} fill="url(#parking-hatch)" opacity={0.5} />
          </g>
        ) : null,
      )}
    </g>
  );
}
