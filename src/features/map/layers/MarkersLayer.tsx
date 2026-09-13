import { Bus, MapPin } from "lucide-react";

import { centroidOfPolygon } from "@/domain/geometry/polygon";
import { mapVar } from "@/features/map/mapTheme";

import type { LucideIcon } from "lucide-react";
import type { MapFeature } from "@/domain/schema";
import type { Point } from "@/domain/geometry/vector";

/**
 * A selectable point-of-interest that isn't a building or a legend-numbered
 * feature (so LabelsLayer never gives it a number badge) still needs a
 * visible, tappable marker — a `plaza`-layer feature only gets a plain fill
 * from HardscapeLayer otherwise, which reads as decorative, not selectable.
 */
const ICON_BY_LABEL: [RegExp, LucideIcon][] = [[/bus/i, Bus]];
function iconFor(label: string | undefined): LucideIcon {
  return ICON_BY_LABEL.find(([re]) => label && re.test(label))?.[1] ?? MapPin;
}

function anchorOf(f: MapFeature): Point | null {
  if (f.geometry.type === "Point") return f.geometry.coordinates;
  if (f.geometry.type === "Polygon") return centroidOfPolygon(f.geometry.coordinates[0] ?? []);
  return null;
}

/**
 * Non-building point-of-interest markers: the campus gates, plus any other
 * `plaza`-layer place (e.g. the bus area) that's selectable but has no
 * legend number of its own.
 */
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
  const markers = features.filter(
    (f) => f.layer === "gate" || (f.layer === "plaza" && f.placeId !== undefined),
  );
  const s = 1 / scale;
  const tappable = Boolean(onSelect);
  return (
    <g>
      {markers.map((f) => {
        const anchor = anchorOf(f);
        if (!anchor) return null;
        const [x, y] = anchor;
        const isActive = hoveredId === f.id || selectedId === f.id;
        const Icon = f.layer === "gate" ? MapPin : iconFor(f.label);
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
            <Icon x={-7} y={-16} width={14} height={14} fill={mapVar.route} stroke="white" strokeWidth={1} />
          </g>
        );
      })}
    </g>
  );
}
