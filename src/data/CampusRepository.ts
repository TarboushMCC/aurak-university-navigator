import type { CampusBundle } from "@/domain/schema";

/**
 * Abstraction over "where campus data comes from". v1 has one implementation
 * (StaticJsonRepository, bundled JSON). A future Phase 4 ApiRepository fetches
 * a published bundle from a backend — nothing above this interface changes
 * when that happens (docs/PLAN.md §1).
 */
export interface CampusRepository {
  getBundle(campusId: string): Promise<CampusBundle>;
}
