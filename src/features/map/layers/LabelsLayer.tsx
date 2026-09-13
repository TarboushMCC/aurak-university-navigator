import { CATEGORY_TINT, buildingTint } from "@/features/map/mapTheme";
import { LAYER_CATEGORY } from "@/features/map/selectablePlaces";

import type { Building, MapFeature } from "@/domain/schema";
import type { Point } from "@/domain/geometry/vector";

const ALWAYS_SHOW_CATEGORIES = new Set(["academic", "services", "sports", "landmark"]);

function featureAnchor(f: MapFeature): Point | null {
  if (f.geometry.type === "Point") return f.geometry.coordinates;
  if (f.geometry.type === "Polygon") {
    const ring = f.geometry.coordinates[0] ?? [];
    if (ring.length === 0) return null;
    return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
  }
  return null;
}

function NumberBadge({
  x,
  y,
  number,
  name,
  tint,
  isEmphasised,
  showName,
  rotationDeg,
  s,
}: {
  x: number;
  y: number;
  number: number;
  name: string;
  tint: string;
  isEmphasised: boolean;
  showName: boolean;
  rotationDeg: number;
  s: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${-rotationDeg}) scale(${s})`} pointerEvents="none">
      <circle r={9} fill={isEmphasised ? tint : "white"} stroke={tint} strokeWidth={1.5} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fontWeight={700}
        fill={isEmphasised ? "white" : tint}
        fontFamily="Inter, sans-serif"
      >
        {number}
      </text>
      {showName && (
        <text
          y={22}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill="var(--color-ink)"
          fontFamily="Inter, sans-serif"
          style={{ paintOrder: "stroke", stroke: "var(--color-ground)", strokeWidth: 3 }}
        >
          {name.length > 28 ? `${name.slice(0, 26)}…` : name}
        </text>
      )}
    </g>
  );
}

export function LabelsLayer({
  buildings,
  features,
  scale,
  rotationDeg,
  hoveredId,
  selectedId,
}: {
  buildings: Building[];
  features: MapFeature[];
  scale: number;
  rotationDeg: number;
  hoveredId: string | null;
  selectedId: string | null;
}) {
  const s = 1 / scale;
  const showName = scale > 1.6;
  return (
    <g>
      {buildings.map((b) => {
        if (!b.labelAt || b.mapNumber === undefined) return null;
        const isEmphasised = hoveredId === b.id || selectedId === b.id;
        const lowPriority = !ALWAYS_SHOW_CATEGORIES.has(b.category);
        if (lowPriority && scale < 0.55 && !isEmphasised) return null;
        const [x, y] = b.labelAt;
        return (
          <NumberBadge
            key={b.id}
            x={x}
            y={y}
            number={b.mapNumber}
            name={b.name}
            tint={buildingTint(b.id, b.category)}
            isEmphasised={isEmphasised}
            // Names only appear on hover/selection or when zoomed in a lot, so
            // the default view reads as clean number badges instead of
            // overlapping text.
            showName={showName || isEmphasised}
            rotationDeg={rotationDeg}
            s={s}
          />
        );
      })}
      {features.map((f) => {
        if (f.mapNumber === undefined || !f.label) return null;
        const anchor = featureAnchor(f);
        if (!anchor) return null;
        const isEmphasised = hoveredId === f.id || selectedId === f.id;
        return (
          <NumberBadge
            key={f.id}
            x={anchor[0]}
            y={anchor[1]}
            number={f.mapNumber}
            name={f.label}
            tint={CATEGORY_TINT[LAYER_CATEGORY[f.layer] ?? "landmark"] ?? "#334155"}
            isEmphasised={isEmphasised}
            showName={showName || isEmphasised}
            rotationDeg={rotationDeg}
            s={s}
          />
        );
      })}
    </g>
  );
}
