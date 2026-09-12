import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { StaticJsonRepository } from "@/data/StaticJsonRepository";
import type { CampusBundle } from "@/domain/schema";

const repository = new StaticJsonRepository();

/**
 * Loads and validates the campus bundle (docs/PLAN.md §3.4: "the app refuses
 * to boot with invalid data" — thrown errors are caught by <ErrorBoundary>).
 *
 * v1's data source is bundled JSON already in memory, so this reads
 * synchronously — no Suspense needed. A future async backend
 * (ApiRepository, Phase 4) will introduce real loading/Suspense at this
 * boundary without changing anything below it.
 */
const CampusContext = createContext<CampusBundle | null>(null);

export function CampusProvider({
  campusId,
  children,
}: {
  campusId: string;
  children: ReactNode;
}) {
  const bundle = useMemo(() => repository.getBundleSync(campusId), [campusId]);
  return <CampusContext value={bundle}>{children}</CampusContext>;
}

export function useCampus(): CampusBundle {
  const bundle = useContext(CampusContext);
  if (!bundle) {
    throw new Error("useCampus() must be used within <CampusProvider>");
  }
  return bundle;
}
