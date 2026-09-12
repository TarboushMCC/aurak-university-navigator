import { polygonToPath } from "@/features/map/layers/polygonPath";
import { mapVar } from "@/features/map/mapTheme";

import type { MapFeature } from "@/domain/schema";
import type { Point } from "@/domain/geometry/vector";

/** Bilinear interpolation within a 4-point quad (corners in ring order), u,v in [0,1]. */
function bilinear(quad: readonly Point[], u: number, v: number): Point {
  const [p0, p1, p2, p3] = quad;
  if (!p0 || !p1 || !p2 || !p3) return [0, 0];
  const top: Point = [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u];
  const bottom: Point = [p3[0] + (p2[0] - p3[0]) * u, p3[1] + (p2[1] - p3[1]) * u];
  return [top[0] + (bottom[0] - top[0]) * v, top[1] + (bottom[1] - top[1]) * v];
}

function FieldMarkings({ quad }: { quad: readonly Point[] }) {
  if (quad.length < 4) return null;
  const mid1 = bilinear(quad, 0.5, 0);
  const mid2 = bilinear(quad, 0.5, 1);
  const center = bilinear(quad, 0.5, 0.5);
  const edgeSample = bilinear(quad, 0.5, 0.15);
  const radius = Math.hypot(edgeSample[0] - center[0], edgeSample[1] - center[1]) * 0.6;
  const boxA1 = bilinear(quad, 0.08, 0.15);
  const boxA2 = bilinear(quad, 0.08, 0.85);
  const boxB1 = bilinear(quad, 0.92, 0.15);
  const boxB2 = bilinear(quad, 0.92, 0.85);

  return (
    <g stroke={mapVar.fieldLine} strokeWidth={0.35} fill="none" opacity={0.85}>
      <line x1={mid1[0]} y1={mid1[1]} x2={mid2[0]} y2={mid2[1]} />
      <circle cx={center[0]} cy={center[1]} r={radius} />
      <line x1={boxA1[0]} y1={boxA1[1]} x2={boxA2[0]} y2={boxA2[1]} />
      <line x1={boxB1[0]} y1={boxB1[1]} x2={boxB2[0]} y2={boxB2[1]} />
    </g>
  );
}

export function GreenLayer({ features }: { features: MapFeature[] }) {
  const lawns = features.filter((f) => f.layer === "lawn" && f.geometry.type === "Polygon");
  const fields = features.filter((f) => f.layer === "field" && f.geometry.type === "Polygon");
  const courts = features.filter((f) => f.layer === "court" && f.geometry.type === "Polygon");

  return (
    <g>
      {lawns.map((f) =>
        f.geometry.type === "Polygon" ? (
          <path key={f.id} d={polygonToPath(f.geometry)} fill={mapVar.lawn} />
        ) : null,
      )}
      {fields.map((f) =>
        f.geometry.type === "Polygon" ? (
          <g key={f.id}>
            <path d={polygonToPath(f.geometry)} fill={mapVar.field} />
            <FieldMarkings quad={f.geometry.coordinates[0] ?? []} />
          </g>
        ) : null,
      )}
      {courts.map((f) =>
        f.geometry.type === "Polygon" ? (
          <path
            key={f.id}
            d={polygonToPath(f.geometry)}
            fill={mapVar.field}
            stroke={mapVar.fieldLine}
            strokeWidth={0.3}
          />
        ) : null,
      )}
    </g>
  );
}
