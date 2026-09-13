import type { BuildingCategory, MapFeature } from "@/domain/schema";

/**
 * The subset of fields a `Building` and a tappable landmark feature (gate,
 * lawn, field, court, parking) have in common — everything BuildingInfoCard
 * and the header pills actually read. A `Building` satisfies this type as-is.
 */
export interface SelectablePlace {
  id: string;
  name: string;
  mapNumber?: number;
  category: BuildingCategory;
  code?: string;
}

/** Reuse the same category colors buildings already use, grouped by feel. */
export const LAYER_CATEGORY: Partial<Record<MapFeature["layer"], BuildingCategory>> = {
  field: "sports",
  court: "sports",
  parking: "facilities",
  gate: "landmark",
  lawn: "landmark",
  plaza: "services",
};

/**
 * Any labeled feature that isn't itself a building footprint — the main
 * legend-numbered landmarks (fields, lawn, the main gate) as well as
 * unnumbered ones like the extra gates split out per docs/PLAN.md §3.3
 * (multiple entrances need to resolve to distinct places). `mapNumber` is
 * optional on `SelectablePlace`, and BuildingInfoCard already skips the
 * number badge when it's absent, so these are just as selectable.
 */
export function deriveLandmarkPlaces(features: MapFeature[]): SelectablePlace[] {
  return features
    .filter((f) => f.layer !== "building" && f.label)
    .map((f) => ({ id: f.id, name: f.label!, mapNumber: f.mapNumber, category: LAYER_CATEGORY[f.layer] ?? "landmark" }));
}
