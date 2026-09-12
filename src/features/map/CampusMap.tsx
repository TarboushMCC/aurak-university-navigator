import { useEffect, useMemo, useRef, useState } from "react";

import { BuildingInfoCard } from "@/features/map/BuildingInfoCard";
import { BuildingsLayer } from "@/features/map/layers/BuildingsLayer";
import { CanopiesLayer } from "@/features/map/layers/CanopiesLayer";
import { GreenLayer } from "@/features/map/layers/GreenLayer";
import { GroundLayer } from "@/features/map/layers/GroundLayer";
import { HardscapeLayer } from "@/features/map/layers/HardscapeLayer";
import { LabelsLayer } from "@/features/map/layers/LabelsLayer";
import { MarkersLayer } from "@/features/map/layers/MarkersLayer";
import { ParkingLayer } from "@/features/map/layers/ParkingLayer";
import { RoadsLayer } from "@/features/map/layers/RoadsLayer";
import { ShadowsLayer } from "@/features/map/layers/ShadowsLayer";
import { TreesLayer } from "@/features/map/layers/TreesLayer";
import { MapControls } from "@/features/map/MapControls";
import { useMapCamera } from "@/features/map/useMapCamera";

import type { Building, CampusMapData } from "@/domain/schema";

export interface CampusMapProps {
  mapData: CampusMapData;
  buildings: Building[];
  /** Called when the user picks "I'm here" on a building's info card. */
  onSetStart?: (buildingId: string) => void;
  /** Called when the user picks "Navigate here" on a building's info card. */
  onSetDestination?: (buildingId: string) => void;
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

  const selectedBuilding = selectedId ? buildingsById.get(selectedId) : undefined;
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
          <ParkingLayer features={mapData.features} />
          <GreenLayer features={mapData.features} />
          <HardscapeLayer features={mapData.features} />
          <CanopiesLayer features={mapData.features} />
          <ShadowsLayer features={mapData.features} />
          <BuildingsLayer
            features={mapData.features}
            buildingsById={buildingsById}
            hoveredId={hoveredId}
            selectedId={selectedId}
            onHover={setHoveredId}
            onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
          />
          <TreesLayer features={mapData.features} scale={snapshot.scale} />
          <MarkersLayer features={mapData.features} scale={snapshot.scale} />
          <LabelsLayer
            buildings={buildings}
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

      {selectedBuilding && (
        <BuildingInfoCard
          building={selectedBuilding}
          isStart={startBuildingId === selectedBuilding.id}
          isDestination={destinationBuildingId === selectedBuilding.id}
          onClose={() => setSelectedId(null)}
          onSetStart={() => onSetStart?.(selectedBuilding.id)}
          onSetDestination={() => onSetDestination?.(selectedBuilding.id)}
        />
      )}
    </div>
  );
}
