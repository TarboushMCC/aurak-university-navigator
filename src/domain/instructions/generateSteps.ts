import { classifyTurn } from "@/domain/instructions/classifyTurn";
import { stepDetail, stepTitle } from "@/domain/instructions/phrasing";
import { distance, dot, normalize, sub, turnAngleDeg } from "@/domain/geometry/vector";

import type { Point } from "@/domain/geometry/vector";
import type { PlannedRoute } from "@/domain/routing/planRoute";
import type { CampusBundle } from "@/domain/schema";

export type Maneuver =
  | "depart"
  | "straight"
  | "slight_left"
  | "slight_right"
  | "left"
  | "right"
  | "sharp_left"
  | "sharp_right"
  | "u_turn"
  | "arrive";

export interface Step {
  index: number;
  maneuver: Maneuver;
  title: string;
  detail: string;
  distanceM: number;
  landmark?: string;
  /** Map-frame point to focus the camera on for this step (where the maneuver happens). */
  focusPoint: Point;
  /** Direction of travel leaving this step's focus point, in degrees (atan2(dy,dx), y-down frame). */
  headingDeg: number;
  /** Which indices into the route's point polyline this step covers, for highlighting. */
  pointRange: [number, number];
}

const LANDMARK_SEARCH_RADIUS_M = 35;
const DEPART_LOOKAHEAD_M = 90;
/** How far off the initial travel heading a "head toward" landmark may sit. */
const DEPART_CONE_COS = Math.cos((50 * Math.PI) / 180);

interface Landmark {
  name: string;
  point: Point;
}

/** Every building's label point, usable as a turn/depart reference (§7.1 step 7). */
function collectLandmarks(bundle: CampusBundle): Landmark[] {
  const featuresByBuilding = new Map(
    bundle.map.features.filter((f) => f.buildingId).map((f) => [f.buildingId!, f]),
  );
  const landmarks: Landmark[] = [];
  for (const building of bundle.buildings) {
    if (building.labelAt) {
      landmarks.push({ name: building.name, point: building.labelAt });
      continue;
    }
    const feature = featuresByBuilding.get(building.id);
    if (feature?.geometry.type === "Polygon") {
      const ring = feature.geometry.coordinates[0]!;
      const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      landmarks.push({ name: building.name, point: [cx, cy] });
    }
  }
  for (const node of bundle.nodes) {
    if (node.name && (node.kind === "landmark" || node.kind === "poi")) {
      landmarks.push({ name: node.name, point: [node.x, node.y] });
    }
  }
  return landmarks;
}

function nearestLandmark(landmarks: Landmark[], point: Point, maxDist: number): string | undefined {
  let best: { name: string; dist: number } | undefined;
  for (const l of landmarks) {
    const d = distance(l.point, point);
    if (d <= maxDist && (!best || d < best.dist)) best = { name: l.name, dist: d };
  }
  return best?.name;
}

function headingOf(v: Point): number {
  return (Math.atan2(v[1], v[0]) * 180) / Math.PI;
}

/**
 * Turns a planned route's polyline into a sequence of walking directions
 * (docs/PLAN.md §7): a depart step, a step per significant turn (straight
 * stretches merge into the step ahead of them), and a final arrival step.
 * Outdoor maneuvers only — no stairs/elevators (v1 is single-level, §10 Phase 2).
 */
export function generateSteps(
  bundle: CampusBundle,
  route: PlannedRoute,
  destinationName: string,
): Step[] {
  const points = route.points;
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [
      {
        index: 0,
        maneuver: "arrive",
        title: stepTitle("arrive", destinationName),
        detail: stepDetail("arrive", 0, destinationName),
        distanceM: 0,
        landmark: destinationName,
        focusPoint: points[0]!,
        headingDeg: 0,
        pointRange: [0, 0],
      },
    ];
  }

  const landmarks = collectLandmarks(bundle);
  const n = points.length;

  // Signed turn angle at each interior point (index 1..n-2).
  const turnAngles: (number | undefined)[] = new Array(n).fill(undefined);
  for (let i = 1; i < n - 1; i++) {
    const a = sub(points[i]!, points[i - 1]!);
    const b = sub(points[i + 1]!, points[i]!);
    turnAngles[i] = turnAngleDeg(a, b);
  }

  const steps: Step[] = [];

  // Depart: from point 0 up to (but not including) the first significant turn,
  // merging any "straight" interior points along the way.
  let segStart = 0;
  let cursor = 1;
  while (cursor < n - 1 && classifyTurn(turnAngles[cursor]!) === "straight") cursor++;
  const departDist = polylineSpan(points, segStart, cursor);
  const departHeadingVec = sub(points[Math.min(segStart + 1, n - 1)]!, points[segStart]!);
  const departHeading = headingOf(departHeadingVec);
  const departLandmark = nearestAheadLandmark(
    landmarks,
    points[segStart]!,
    departHeadingVec,
    DEPART_LOOKAHEAD_M,
  );
  steps.push({
    index: 0,
    maneuver: "depart",
    title: stepTitle("depart", departLandmark),
    detail: stepDetail("depart", departDist, departLandmark),
    distanceM: departDist,
    landmark: departLandmark,
    focusPoint: points[segStart]!,
    headingDeg: departHeading,
    pointRange: [segStart, cursor],
  });
  segStart = cursor;

  // Each remaining significant turn becomes its own step, covering the
  // distance from this turn up to (but not including) the next one.
  while (segStart < n - 1) {
    const turnManeuver = segStart < n - 1 && turnAngles[segStart] !== undefined
      ? classifyTurn(turnAngles[segStart]!)
      : "straight";
    let next = segStart + 1;
    while (next < n - 1 && classifyTurn(turnAngles[next]!) === "straight") next++;

    const dist = polylineSpan(points, segStart, next);
    const heading = headingOf(sub(points[Math.min(segStart + 1, n - 1)]!, points[segStart]!));
    const landmark = nearestLandmark(landmarks, points[segStart]!, LANDMARK_SEARCH_RADIUS_M);
    steps.push({
      index: steps.length,
      maneuver: turnManeuver,
      title: stepTitle(turnManeuver, landmark),
      detail: stepDetail(turnManeuver, dist, landmark),
      distanceM: dist,
      landmark,
      focusPoint: points[segStart]!,
      headingDeg: heading,
      pointRange: [segStart, next],
    });
    segStart = next;
  }

  steps.push({
    index: steps.length,
    maneuver: "arrive",
    title: stepTitle("arrive", destinationName),
    detail: stepDetail("arrive", 0, destinationName),
    distanceM: 0,
    landmark: destinationName,
    focusPoint: points[n - 1]!,
    headingDeg: steps.length > 0 ? steps[steps.length - 1]!.headingDeg : 0,
    pointRange: [n - 1, n - 1],
  });

  return steps.map((s, i) => ({ ...s, index: i }));
}

function polylineSpan(points: Point[], from: number, to: number): number {
  let total = 0;
  for (let i = from; i < to; i++) total += distance(points[i]!, points[i + 1]!);
  return total;
}

/**
 * The nearest landmark that's actually ahead of the walker as they set off —
 * within `maxDist` of the start point AND inside a forward cone of the
 * initial heading — rather than merely near some point further along the
 * path (which could be beside or behind them when they start walking).
 */
function nearestAheadLandmark(
  landmarks: Landmark[],
  from: Point,
  headingVec: Point,
  maxDist: number,
): string | undefined {
  const heading = normalize(headingVec);
  if (heading[0] === 0 && heading[1] === 0) return undefined;

  let best: { name: string; dist: number } | undefined;
  for (const l of landmarks) {
    const toLandmark = sub(l.point, from);
    const dist = distance(l.point, from);
    if (dist === 0 || dist > maxDist) continue;
    const cos = dot(heading, normalize(toLandmark));
    if (cos < DEPART_CONE_COS) continue;
    if (!best || dist < best.dist) best = { name: l.name, dist };
  }
  return best?.name;
}
