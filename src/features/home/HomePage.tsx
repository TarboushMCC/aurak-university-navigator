import { useEffect, useMemo, useState } from "react";

import { CampusMap } from "@/features/map/CampusMap";
import { deriveLandmarkPlaces } from "@/features/map/selectablePlaces";
import { generateSteps } from "@/domain/instructions/generateSteps";
import { planRoute } from "@/domain/routing/planRoute";
import { resolvePlaceId, selectionIdForPlace } from "@/domain/routing/resolvePlaceId";
import { buildSearchEntries, createSearchIndex } from "@/domain/search/searchIndex";
import { GuideView } from "@/features/guide/GuideView";
import { LocationPicker } from "@/features/location-picker/LocationPicker";
import { LocationSearchSheet } from "@/features/location-picker/LocationSearchSheet";
import { useRecentPlaces } from "@/features/location-picker/useRecentPlaces";
import { useCampus } from "@/app/CampusProvider";

import type { SelectablePlace } from "@/features/map/selectablePlaces";
import type { SearchEntry } from "@/domain/search/searchIndex";

export function HomePage() {
  const campus = useCampus();
  const [startId, setStartId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [activePicker, setActivePicker] = useState<"from" | "to" | null>(null);
  const { recentIds, addRecent } = useRecentPlaces();

  const placesById = useMemo(() => {
    const map = new Map<string, SelectablePlace>(campus.buildings.map((b) => [b.id, b]));
    for (const place of deriveLandmarkPlaces(campus.map.features)) map.set(place.id, place);
    return map;
  }, [campus.buildings, campus.map.features]);

  const searchEntries = useMemo(() => buildSearchEntries(campus), [campus]);
  const searchIndex = useMemo(() => createSearchIndex(searchEntries), [searchEntries]);

  const startBuilding = startId ? placesById.get(startId) : undefined;
  const destinationBuilding = destinationId ? placesById.get(destinationId) : undefined;

  const route = useMemo(() => {
    if (!startId || !destinationId) return null;
    const fromPlaceId = resolvePlaceId(campus, startId);
    const toPlaceId = resolvePlaceId(campus, destinationId);
    if (!fromPlaceId || !toPlaceId) return null;
    return planRoute(campus, fromPlaceId, toPlaceId);
  }, [campus, startId, destinationId]);

  const steps = useMemo(() => {
    if (!route || !destinationBuilding) return null;
    return generateSteps(campus, route, destinationBuilding.name);
  }, [campus, route, destinationBuilding]);

  const [guideOpen, setGuideOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setStepIndex(0);
    if (!route) setGuideOpen(false);
  }, [route]);

  function handlePickerSelect(entry: SearchEntry) {
    const selectionId = selectionIdForPlace(campus, entry.id);
    if (!selectionId) return;
    if (activePicker === "from") setStartId(selectionId);
    else if (activePicker === "to") setDestinationId(selectionId);
    addRecent(entry.id);
    setActivePicker(null);
  }

  return (
    // `h-dvh` (dynamic viewport height), not `h-screen` (100vh): on mobile
    // Chrome, 100vh includes the area the collapsible URL bar covers, so
    // anything sized to it and clipped with overflow-hidden — like the
    // "Navigate here" button on the building info card — was rendering
    // below the actually-visible viewport whenever the toolbar was shown.
    <main className="flex h-dvh w-full flex-col overflow-hidden">
      <header
        className="z-10 flex flex-col gap-2.5 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="flex items-center gap-2.5">
          <img
            src="/sga-logo.png"
            alt="Student Government Association crest"
            className="h-10 w-10 shrink-0 rounded-full shadow-sm"
          />
          <div>
            <h1 className="text-lg leading-tight font-bold text-(--color-ink)">
              {campus.campus.shortName} University Navigator
            </h1>
            <p className="text-xs font-semibold tracking-wide text-(--color-gold) uppercase">
              Powered by SGA
            </p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 text-sm sm:max-w-md sm:flex-1">
          <LocationPicker
            label="From"
            value={startBuilding?.name ?? "Where are you?"}
            tone="start"
            onClick={() => setActivePicker("from")}
          />
          <span className="text-(--color-ink-muted)">→</span>
          <LocationPicker
            label="To"
            value={destinationBuilding?.name ?? "Where to?"}
            tone="destination"
            onClick={() => setActivePicker("to")}
          />
        </div>

        {startId && destinationId && (
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <p className="text-xs font-medium text-(--color-ink-muted)">
              {route
                ? `~${Math.round(route.durationS / 60)} min walk · ~${Math.round(route.distanceM)} m`
                : "No walking route found between these yet"}
            </p>
            {steps && (
              <button
                type="button"
                onClick={() => {
                  setStepIndex(0);
                  setGuideOpen(true);
                }}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
              >
                Guide
              </button>
            )}
          </div>
        )}
      </header>

      <div className="relative flex-1">
        <CampusMap
          mapData={campus.map}
          buildings={campus.buildings}
          nodes={campus.nodes}
          edges={campus.edges}
          route={route}
          startBuildingId={startId}
          destinationBuildingId={destinationId}
          onSetStart={(id) => setStartId(id)}
          onSetDestination={(id) => setDestinationId(id)}
        />
        {guideOpen && route && steps && (
          <GuideView
            steps={steps}
            stepIndex={stepIndex}
            onStepChange={setStepIndex}
            route={route}
            features={campus.map.features}
            onExit={() => setGuideOpen(false)}
          />
        )}
      </div>

      {activePicker && (
        <LocationSearchSheet
          title={activePicker === "from" ? "Where are you?" : "Where do you want to go?"}
          index={searchIndex}
          entries={searchEntries}
          recentIds={recentIds}
          onSelect={handlePickerSelect}
          onClose={() => setActivePicker(null)}
        />
      )}
    </main>
  );
}
