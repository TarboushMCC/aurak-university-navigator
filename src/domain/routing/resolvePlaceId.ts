import type { CampusBundle } from "@/domain/schema";

/**
 * CampusMap's selection ids aren't Place ids: a building is selected by its
 * Building.id (e.g. "bldg-a"), and a landmark by the MapFeature.id it was
 * clicked on (e.g. "gate-8") — see selectablePlaces.ts. Routing needs the
 * actual Place record (for its anchors), so this bridges either selection
 * id back to the Place it corresponds to, via each feature's own `placeId`
 * (set at import time) — not a layer-based guess, since a campus can have
 * more than one of the same kind of landmark (e.g. multiple gates), each
 * needing to resolve to its own distinct Place.
 */
export function resolvePlaceId(bundle: CampusBundle, selectionId: string): string | undefined {
  if (selectionId.startsWith("bldg-")) {
    return bundle.places.find((p) => p.buildingId === selectionId)?.id;
  }
  return bundle.map.features.find((f) => f.id === selectionId)?.placeId;
}

/**
 * The inverse of `resolvePlaceId`: given a Place id (what search results and
 * the "I'm here"/"Navigate here" buttons work in), returns the map-tap
 * "selection id" the rest of the UI (CampusMap, BuildingInfoCard highlight
 * state) already expects — a building id, or the map feature that stands in
 * for a non-building place (a gate, a field, ...).
 */
export function selectionIdForPlace(bundle: CampusBundle, placeId: string): string | undefined {
  const place = bundle.places.find((p) => p.id === placeId);
  if (!place) return undefined;
  if (place.buildingId) return place.buildingId;
  return bundle.map.features.find((f) => f.placeId === placeId)?.id;
}
