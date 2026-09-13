import Fuse from "fuse.js";

import type { BuildingCategory, CampusBundle, Place, PlaceType } from "@/domain/schema";

export interface SearchEntry {
  id: string;
  name: string;
  aliases: string[];
  code?: string;
  mapNumber?: number;
  type: PlaceType;
  category: BuildingCategory;
}

/** Fallback tint category for a place with no linked building record. */
const PLACE_TYPE_CATEGORY: Record<PlaceType, BuildingCategory> = {
  building: "academic",
  room: "academic",
  department: "academic",
  facility: "facilities",
  landmark: "landmark",
  service: "services",
  parking: "facilities",
  gate: "landmark",
  residence: "residence",
  sports: "sports",
};

function toEntry(bundle: CampusBundle, place: Place): SearchEntry {
  const building = place.buildingId ? bundle.buildings.find((b) => b.id === place.buildingId) : undefined;
  return {
    id: place.id,
    name: place.name,
    aliases: place.aliases,
    code: building?.code,
    mapNumber: place.mapNumber ?? building?.mapNumber,
    type: place.type,
    category: building?.category ?? PLACE_TYPE_CATEGORY[place.type],
  };
}

/** Every startable place as a flat, searchable, display-ready entry (docs/PLAN.md §8.1 Home picker). */
export function buildSearchEntries(bundle: CampusBundle): SearchEntry[] {
  return bundle.places.filter((p) => p.startable).map((p) => toEntry(bundle, p));
}

export function createSearchIndex(entries: SearchEntry[]): Fuse<SearchEntry> {
  return new Fuse(entries, {
    keys: [
      { name: "name", weight: 0.5 },
      { name: "aliases", weight: 0.3 },
      { name: "code", weight: 0.15 },
      { name: "mapNumber", weight: 0.05 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 1,
  });
}

export function search(index: Fuse<SearchEntry>, query: string): SearchEntry[] {
  if (!query.trim()) return [];
  return index.search(query).map((r) => r.item);
}
