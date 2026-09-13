import { MapPin } from "lucide-react";

import { mapVar } from "@/features/map/mapTheme";

import type { MapFeature } from "@/domain/schema";

/** Non-building point-of-interest markers (currently: the campus gate). */
export function MarkersLayer({
  features,
  scale,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
}: {
  features: MapFeature[];
  scale: number;
  hoveredId?: string | null;
  selectedId?: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
}) {
  const gates = features.filter((f) => f.layer === "gate" && f.geometry.type === "Point");
  const s = 1 / scale;
  const tappable = Boolean(onSelect);
  return (
    <g>
      {gates.map((f) => {
        if (f.geometry.type !== "Point") return null;
        const [x, y] = f.geometry.coordinates;
        const isActive = hoveredId === f.id || selectedId === f.id;
        return (
          <g
            key={f.id}
            transform={`translate(${x} ${y}) scale(${s})`}
            onPointerEnter={() => onHover?.(f.id)}
            onPointerLeave={() => onHover?.(null)}
            onClick={() => onSelect?.(f.id)}
            style={{ cursor: tappable ? "pointer" : undefined }}
          >
            {isActive && <circle r={11} fill="none" stroke={mapVar.route} strokeWidth={1.5} opacity={0.5} />}
            <circle r={5} fill={mapVar.building} stroke={mapVar.route} strokeWidth={1.5} />
            <MapPin
              x={-7}
              y={-16}
              width={14}
              height={14}
              fill={mapVar.route}
              stroke="white"
              strokeWidth={1}
            />
          </g>
        );
      })}
    </g>
  );
}
