import { CATEGORY_TINT } from "@/features/map/mapTheme";

import type { Building } from "@/domain/schema";

const ALWAYS_SHOW_CATEGORIES = new Set(["academic", "services", "sports", "landmark"]);

export function LabelsLayer({
  buildings,
  scale,
  rotationDeg,
  hoveredId,
  selectedId,
}: {
  buildings: Building[];
  scale: number;
  rotationDeg: number;
  hoveredId: string | null;
  selectedId: string | null;
}) {
  const s = 1 / scale;
  return (
    <g>
      {buildings.map((b) => {
        if (!b.labelAt) return null;
        const isEmphasised = hoveredId === b.id || selectedId === b.id;
        const lowPriority = !ALWAYS_SHOW_CATEGORIES.has(b.category);
        if (lowPriority && scale < 0.55 && !isEmphasised) return null;
        const [x, y] = b.labelAt;
        const tint = CATEGORY_TINT[b.category] ?? "#334155";
        // Names only appear on hover/selection or when zoomed in a lot, so the
        // default view reads as clean number badges instead of overlapping text.
        const showName = scale > 1.6 || isEmphasised;

        return (
          <g
            key={b.id}
            transform={`translate(${x} ${y}) rotate(${-rotationDeg}) scale(${s})`}
            pointerEvents="none"
          >
            {b.mapNumber !== undefined && (
              <g>
                <circle
                  r={9}
                  fill={isEmphasised ? tint : "white"}
                  stroke={tint}
                  strokeWidth={1.5}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fontWeight={700}
                  fill={isEmphasised ? "white" : tint}
                  fontFamily="Inter, sans-serif"
                >
                  {b.mapNumber}
                </text>
              </g>
            )}
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
                {b.name.length > 28 ? `${b.name.slice(0, 26)}…` : b.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
