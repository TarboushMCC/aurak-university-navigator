import { useEffect, useMemo, useRef, useState } from "react";

import { BuildingInfoCard } from "@/features/map/BuildingInfoCard";
import { BuildingsLayer } from "@/features/map/layers/BuildingsLayer";
import { CanopiesLayer } from "@/features/map/layers/CanopiesLayer";
import { DoorsLayer } from "@/features/map/layers/DoorsLayer";
import { GreenLayer } from "@/features/map/layers/GreenLayer";
import { GroundLayer } from "@/features/map/layers/GroundLayer";
import { HardscapeLayer } from "@/features/map/layers/HardscapeLayer";
import { LabelsLayer } from "@/features/map/layers/LabelsLayer";
import { MarkersLayer } from "@/features/map/layers/MarkersLayer";
import { ParkingLayer } from "@/features/map/layers/ParkingLayer";
import { RoadsLayer } from "@/features/map/layers/RoadsLayer";
import { ShadowsLayer } from "@/features/map/layers/ShadowsLayer";
import { RouteLayer } from "@/features/map/layers/RouteLayer";
import { TreesLayer } from "@/features/map/layers/TreesLayer";
import { WalkwayLayer } from "@/features/map/layers/WalkwayLayer";
import { MapControls } from "@/features/map/MapControls";
import { deriveLandmarkPlaces } from "@/features/map/selectablePlaces";
import type { SelectablePlace } from "@/features/map/selectablePlaces";
import { useMapCamera } from "@/features/map/useMapCamera";

import type { Building, CampusMapData, GraphEdge, GraphNode } from "@/domain/schema";
import type { PlannedRoute } from "@/domain/routing/planRoute";

export interface CampusMapProps {
  mapData: CampusMapData;
  buildings: Building[];
  /** Walkway graph — shown as a faint review overlay so it stays visible even without an active route. */
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  /** The currently planned route (both a start and destination are set), drawn on top of the walkway overlay. */
  route?: PlannedRoute | null;
  /** Called when the user picks "I'm here" on a place's info card. */
  onSetStart?: (placeId: string) => void;
  /** Called when the user picks "Navigate here" on a place's info card. */
  onSetDestination?: (placeId: string) => void;
  startBuildingId?: string | null;
  destinationBuildingId?: string | null;
}

/** Tracks a DOM element's content-box size via ResizeObserver. */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

export function CampusMap({
  mapData,
  buildings,
  nodes,
  edges,
  route,
  onSetStart,
  onSetDestination,
  startBuildingId,
  destinationBuildingId,
}: CampusMapProps) {
  const { ref: containerRef, size: containerSize } = useElementSize<HTMLDivElement>();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const camera = useMapCamera(containerRef, {
    cx: mapData.bounds.width / 2,
    cy: mapData.bounds.height / 2,
    scale: 1,
    rotationDeg: 0,
  });

  const buildingsById = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);
  const landmarkPlaces = useMemo(() => deriveLandmarkPlaces(mapData.features), [mapData.features]);
  const placesById = useMemo(() => {
    const map = new Map<string, SelectablePlace>(buildingsById);
    for (const place of landmarkPlaces) map.set(place.id, place);
    return map;
  }, [buildingsById, landmarkPlaces]);

  // Fit the whole campus once we know the container's size.
  const didInitialFit = useRef(false);
  useEffect(() => {
    if (didInitialFit.current) return;
    if (containerSize.width === 0 || containerSize.height === 0) return;
    didInitialFit.current = true;
    camera.fitBounds([0, 0, mapData.bounds.width, mapData.bounds.height], {
      padding: 0.06,
      durationMs: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerSize.width, containerSize.height]);

  const selectedPlace = selectedId ? placesById.get(selectedId) : undefined;
  const { snapshot } = camera;
  const tx = containerSize.width / 2 - snapshot.cx * snapshot.scale;
  const ty = containerSize.height / 2 - snapshot.cy * snapshot.scale;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none overflow-hidden select-none"
      style={{ background: "var(--map-ground)" }}
    >
      <svg width="100%" height="100%" className="block">
        <g
          transform={`translate(${tx} ${ty}) scale(${snapshot.scale}) rotate(${snapshot.rotationDeg} ${snapshot.cx} ${snapshot.cy})`}
        >
          <GroundLayer bounds={mapData.bounds} features={mapData.features} />
          <RoadsLayer features={mapData.features} />
          <ParkingLayer
            features={mapData.features}
            hoveredId={hoveredId}
            selectedId={selectedId}
            onHover={setHoveredId}
            onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
          />
          <GreenLayer
            features={mapData.features}
            hoveredId={hoveredId}
            selectedId={selectedId}
            onHover={setHoveredId}
            onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
          />
          <HardscapeLayer features={mapData.features} />
          <CanopiesLayer features={mapData.features} />
          {nodes && edges && <WalkwayLayer nodes={nodes} edges={edges} dimmed={Boolean(route)} />}
          <ShadowsLayer features={mapData.features} />
          <BuildingsLayer
            features={mapData.features}
            buildingsById={buildingsById}
            hoveredId={hoveredId}
            selectedId={selectedId}
            hasRoute={Boolean(route)}
            routeBuildingIds={route ? new Set(route.buildingIds) : undefined}
            onHover={setHoveredId}
            onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
          />
          {nodes && <DoorsLayer nodes={nodes} buildingsById={buildingsById} scale={snapshot.scale} />}
          {route && <RouteLayer points={route.points} />}
          <TreesLayer features={mapData.features} scale={snapshot.scale} />
          <MarkersLayer
            features={mapData.features}
            scale={snapshot.scale}
            hoveredId={hoveredId}
            selectedId={selectedId}
            onHover={setHoveredId}
            onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
          />
          <LabelsLayer
            buildings={buildings}
            features={mapData.features}
            scale={snapshot.scale}
            rotationDeg={snapshot.rotationDeg}
            hoveredId={hoveredId}
            selectedId={selectedId}
          />
        </g>
      </svg>

      <MapControls
        onZoomIn={() => camera.flyTo({ scale: snapshot.scale * 1.4 }, 200)}
        onZoomOut={() => camera.flyTo({ scale: snapshot.scale / 1.4 }, 200)}
        onRecenter={() =>
          camera.fitBounds([0, 0, mapData.bounds.width, mapData.bounds.height], { padding: 0.06 })
        }
      />

      {selectedPlace && (
        <BuildingInfoCard
          building={selectedPlace}
          isStart={startBuildingId === selectedPlace.id}
          isDestination={destinationBuildingId === selectedPlace.id}
          onClose={() => setSelectedId(null)}
          onSetStart={() => onSetStart?.(selectedPlace.id)}
          onSetDestination={() => onSetDestination?.(selectedPlace.id)}
        />
      )}
    </div>
  );
}
