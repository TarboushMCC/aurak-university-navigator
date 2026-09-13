import { motion } from "motion/react";

import { polygonToPath } from "@/features/map/layers/polygonPath";
import { buildingTint, mapVar } from "@/features/map/mapTheme";

import type { Building, MapFeature } from "@/domain/schema";

export function BuildingsLayer({
  features,
  buildingsById,
  hoveredId,
  selectedId,
  routeBuildingIds,
  hasRoute,
  onHover,
  onSelect,
}: {
  features: MapFeature[];
  buildingsById: Map<string, Building>;
  hoveredId: string | null;
  selectedId: string | null;
  routeBuildingIds?: Set<string>;
  hasRoute?: boolean;
  onHover: (buildingId: string | null) => void;
  onSelect: (buildingId: string) => void;
}) {
  const buildingFeatures = features.filter(
    (f) => f.layer === "building" && f.geometry.type === "Polygon" && f.buildingId,
  );

  return (
    <g>
      {buildingFeatures.map((f) => {
        if (f.geometry.type !== "Polygon" || !f.buildingId) return null;
        const building = buildingsById.get(f.buildingId);
        if (!building) return null;
        const isHovered = hoveredId === building.id;
        const isSelected = selectedId === building.id;
        const dimmed = hasRoute && routeBuildingIds && !routeBuildingIds.has(building.id);
        const tint = buildingTint(building.id, building.category);
        const d = polygonToPath(f.geometry);

        return (
          <motion.g
            key={f.id}
            onPointerEnter={() => onHover(building.id)}
            onPointerLeave={() => onHover(null)}
            onClick={() => onSelect(building.id)}
            style={{ cursor: "pointer" }}
            animate={{ opacity: dimmed ? 0.45 : 1 }}
            transition={{ duration: 0.25 }}
          >
            {(isHovered || isSelected) && (
              <path
                d={d}
                fill="none"
                stroke={tint}
                strokeWidth={isSelected ? 3.5 : 2.5}
                opacity={0.5}
                vectorEffect="non-scaling-stroke"
                style={{ filter: "blur(2px)" }}
              />
            )}
            <path d={d} fill={mapVar.building} />
            <path d={d} fill={tint} opacity={isHovered || isSelected ? 0.32 : 0.2} />
            <path
              d={d}
              fill="none"
              stroke={tint}
              strokeWidth={isHovered || isSelected ? 2 : 1.3}
              opacity={isHovered || isSelected ? 1 : 0.75}
              vectorEffect="non-scaling-stroke"
            />
          </motion.g>
        );
      })}
    </g>
  );
}
