import { mapVar } from "@/features/map/mapTheme";

import type { Point } from "@/domain/geometry/vector";

export function RouteLayer({ points }: { points: Point[] }) {
  if (points.length < 2) return null;
  const d = `M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")}`;
  return (
    <g pointerEvents="none">
      <path
        d={d}
        fill="none"
        stroke={mapVar.routeCasing}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={d}
        fill="none"
        stroke={mapVar.route}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {[points[0]!, points[points.length - 1]!].map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r={4}
          fill={i === 0 ? "var(--color-start)" : "var(--color-destination)"}
          stroke="white"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}
