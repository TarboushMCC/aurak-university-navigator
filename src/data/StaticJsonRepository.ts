import { campusBundleSchema } from "@/domain/schema";
import type { CampusBundle } from "@/domain/schema";

import aurakBuildings from "@/campus-data/aurak/buildings.json";
import aurakCampus from "@/campus-data/aurak/campus.json";
import aurakEdges from "@/campus-data/aurak/edges.json";
import aurakMap from "@/campus-data/aurak/map.json";
import aurakNodes from "@/campus-data/aurak/nodes.json";
import aurakPlaces from "@/campus-data/aurak/places.json";

import type { CampusRepository } from "@/data/CampusRepository";

const RAW_BUNDLES: Record<string, unknown> = {
  aurak: {
    schemaVersion: 1,
    campus: aurakCampus.campus,
    levels: aurakCampus.levels,
    map: aurakMap,
    buildings: aurakBuildings,
    nodes: aurakNodes,
    edges: aurakEdges,
    places: aurakPlaces,
  },
};

export class CampusValidationError extends Error {
  readonly issues: readonly { path: string; message: string }[];

  constructor(campusId: string, issues: readonly { path: string; message: string }[]) {
    super(
      `Campus data for "${campusId}" failed validation:\n` +
        issues.map((i) => `  - ${i.path || "(root)"}: ${i.message}`).join("\n"),
    );
    this.name = "CampusValidationError";
    this.issues = issues;
  }
}

/**
 * v1 CampusRepository: reads campus data bundled at build time from
 * src/campus-data/<campusId>/*.json (docs/PLAN.md §3.4). Validates with zod
 * and throws (rather than silently rendering broken data) on any issue.
 *
 * The data is already in memory (statically imported), so `getBundleSync`
 * is the real implementation; `getBundle` just wraps it in a resolved
 * promise to satisfy CampusRepository for a future async (Phase 4) backend.
 */
export class StaticJsonRepository implements CampusRepository {
  getBundleSync(campusId: string): CampusBundle {
    const raw = RAW_BUNDLES[campusId];
    if (!raw) {
      throw new Error(`Unknown campus id: "${campusId}"`);
    }
    const result = campusBundleSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      throw new CampusValidationError(campusId, issues);
    }
    return result.data;
  }

  async getBundle(campusId: string): Promise<CampusBundle> {
    return this.getBundleSync(campusId);
  }
}
