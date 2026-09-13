import { MapPin } from "lucide-react";

import { bbox } from "@/domain/geometry/vector";
import { polygonToPath } from "@/features/map/layers/polygonPath";
import { mapVar } from "@/features/map/mapTheme";

import type { Step } from "@/domain/instructions/generateSteps";
import type { PlannedRoute } from "@/domain/routing/planRoute";
import type { MapFeature } from "@/domain/schema";

export interface RouteOverviewMapProps {
  features: MapFeature[];
  route: PlannedRoute;
  step: Step;
}

const MIN_SPAN_M = 90;
const PADDING_RATIO = 0.22;

/**
 * A stable, un-rotating overview of the whole route (docs/PLAN.md §8.2 mini
 * map, reworked): fixed framing computed once from the full path, so it
 * never re-zooms or re-rotates between steps. What changes per step is only
 * which stretch of the line is highlighted and where the walker dot sits —
 * everyone's orientation stays put, which is what a small preview needs.
 */
export function RouteOverviewMap({ features, route, step }: RouteOverviewMapProps) {
  const points = route.points;
  const [minX, minY, maxX, maxY] = bbox(points);
  const spanX = Math.max(maxX - minX, MIN_SPAN_M);
  const spanY = Math.max(maxY - minY, MIN_SPAN_M);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const padX = spanX * PADDING_RATIO;
  const padY = spanY * PADDING_RATIO;
  const viewW = spanX + padX * 2;
  const viewH = spanY + padY * 2;
  const viewX = cx - viewW / 2;
  const viewY = cy - viewH / 2;

  const [fromIdx, toIdx] = step.pointRange;
  const traveled = points.slice(0, fromIdx + 1);
  const current = points.slice(fromIdx, toIdx + 1);
  const upcoming = points.slice(toIdx);

  const toSvgPoints = (pts: typeof points) => pts.map(([x, y]) => `${x},${y}`).join(" ");
  const strokeW = Math.max(viewW, viewH) * 0.012;

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: "var(--color-border)", background: mapVar.ground }}
    >
      <svg
        viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
        width="100%"
        height={168}
        role="img"
        aria-label={`Map of the full route, currently on step ${step.index + 1}`}
      >
        {features
          .filter((f) => f.layer === "building" && f.geometry.type === "Polygon")
          .map((f) => (
            <path
              key={f.id}
              d={polygonToPath(f.geometry as Extract<typeof f.geometry, { type: "Polygon" }>)}
              fill={mapVar.building}
              stroke={mapVar.buildingOutline}
              strokeWidth={strokeW * 0.4}
            />
          ))}

        {upcoming.length > 1 && (
          <polyline
            points={toSvgPoints(upcoming)}
            fill="none"
            stroke={mapVar.route}
            strokeOpacity={0.55}
            strokeWidth={strokeW}
            strokeDasharray={`${strokeW * 0.4} ${strokeW * 1.1}`}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {traveled.length > 1 && (
          <polyline
            points={toSvgPoints(traveled)}
            fill="none"
            stroke="var(--color-ink-muted)"
            strokeOpacity={0.55}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {current.length > 1 && (
          <>
            <polyline
              points={toSvgPoints(current)}
              fill="none"
              stroke={mapVar.routeCasing}
              strokeWidth={strokeW * 2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={toSvgPoints(current)}
              fill="none"
              stroke={mapVar.route}
              strokeWidth={strokeW * 1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        <circle
          cx={points[0]![0]}
          cy={points[0]![1]}
          r={strokeW * 1.1}
          fill="var(--color-start)"
          stroke={mapVar.ground}
          strokeWidth={strokeW * 0.6}
        />
        <MapPin
          x={points.at(-1)![0] - strokeW * 1.6}
          y={points.at(-1)![1] - strokeW * 3.4}
          width={strokeW * 3.2}
          height={strokeW * 3.2}
          fill="var(--color-destination)"
          stroke={mapVar.ground}
          strokeWidth={strokeW * 0.35}
        />

        <circle cx={step.focusPoint[0]} cy={step.focusPoint[1]} r={strokeW * 1.5} fill="var(--color-accent)" opacity={0.25} />
        <circle
          cx={step.focusPoint[0]}
          cy={step.focusPoint[1]}
          r={strokeW * 0.9}
          fill="var(--color-accent)"
          stroke={mapVar.ground}
          strokeWidth={strokeW * 0.45}
        />
      </svg>
    </div>
  );
}
