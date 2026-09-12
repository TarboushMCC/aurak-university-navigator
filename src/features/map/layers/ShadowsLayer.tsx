import { polygonToPath } from "@/features/map/layers/polygonPath";
import { mapVar } from "@/features/map/mapTheme";

import type { MapFeature } from "@/domain/schema";

/** Offsets a polygon feature toward a fixed "light" direction, scaled by its height. */
function offsetShadow(
  geometry: Extract<MapFeature["geometry"], { type: "Polygon" }>,
  heightM: number,
): Extract<MapFeature["geometry"], { type: "Polygon" }> {
  const k = 0.12;
  const dx = heightM * k;
  const dy = heightM * k;
  return {
    ...geometry,
    coordinates: geometry.coordinates.map((ring) =>
      ring.map(([x, y]): [number, number] => [x + dx, y + dy]),
    ),
  };
}

export function ShadowsLayer({ features }: { features: MapFeature[] }) {
  const buildings = features.filter((f) => f.layer === "building" && f.geometry.type === "Polygon");
  return (
    <g opacity={0.9} filter="url(#shadow-blur)">
      <defs>
        <filter id="shadow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={1.4} />
        </filter>
      </defs>
      {buildings.map((f) => {
        if (f.geometry.type !== "Polygon") return null;
        const shadow = offsetShadow(f.geometry, f.heightM ?? 10);
        return <path key={f.id} d={polygonToPath(shadow)} fill={mapVar.buildingShadow} />;
      })}
    </g>
  );
}
