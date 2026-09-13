import { polygonToPath } from "@/features/map/layers/polygonPath";
import { mapVar } from "@/features/map/mapTheme";

import type { MapFeature } from "@/domain/schema";

export function ParkingLayer({
  features,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
}: {
  features: MapFeature[];
  hoveredId?: string | null;
  selectedId?: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
}) {
  const lots = features.filter((f) => f.layer === "parking" && f.geometry.type === "Polygon");
  const tappable = Boolean(onSelect);
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
      {lots.map((f) => {
        if (f.geometry.type !== "Polygon") return null;
        const isActive = hoveredId === f.id || selectedId === f.id;
        const d = polygonToPath(f.geometry);
        return (
          <g
            key={f.id}
            onPointerEnter={() => onHover?.(f.id)}
            onPointerLeave={() => onHover?.(null)}
            onClick={() => onSelect?.(f.id)}
            style={{ cursor: tappable ? "pointer" : undefined }}
          >
            <path d={d} fill={mapVar.parking} />
            <path d={d} fill="url(#parking-hatch)" opacity={0.5} />
            {isActive && (
              <path
                d={d}
                fill="none"
                stroke={mapVar.walkwayEdge}
                strokeWidth={selectedId === f.id ? 2.5 : 1.8}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        );
      })}
    </g>
  );
}
