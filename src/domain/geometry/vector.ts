/**
 * Pure 2D vector/point helpers used throughout the domain layer.
 * A "point" and a "vector" are both just [x, y] tuples in map metres
 * unless documented otherwise (see docs/PLAN.md §3.1 for the coordinate frame).
 */

export type Point = readonly [number, number];

export function add(a: Point, b: Point): Point {
  return [a[0] + b[0], a[1] + b[1]];
}

export function sub(a: Point, b: Point): Point {
  return [a[0] - b[0], a[1] - b[1]];
}

export function scale(a: Point, s: number): Point {
  return [a[0] * s, a[1] * s];
}

export function length(a: Point): number {
  return Math.hypot(a[0], a[1]);
}

export function distance(a: Point, b: Point): number {
  return length(sub(a, b));
}

export function normalize(a: Point): Point {
  const len = length(a);
  if (len === 0) return [0, 0];
  return [a[0] / len, a[1] / len];
}

export function dot(a: Point, b: Point): number {
  return a[0] * b[0] + a[1] * b[1];
}

/** 2D "cross product" (z-component of the 3D cross product). */
export function cross(a: Point, b: Point): number {
  return a[0] * b[1] - a[1] * b[0];
}

export function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function centroid(points: readonly Point[]): Point {
  if (points.length === 0) return [0, 0];
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p[0];
    sy += p[1];
  }
  return [sx / points.length, sy / points.length];
}

/**
 * Signed turn angle in degrees between two heading vectors `a` (incoming)
 * and `b` (outgoing), in a y-down frame. Positive = right turn.
 * Range: (-180, 180].
 */
export function turnAngleDeg(a: Point, b: Point): number {
  const c = cross(a, b);
  const d = dot(a, b);
  return (Math.atan2(c, d) * 180) / Math.PI;
}

export function lerp(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Total length of a polyline (sum of segment lengths). */
export function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) continue;
    total += distance(prev, curr);
  }
  return total;
}

/** Axis-aligned bounding box [minX, minY, maxX, maxY] of a set of points. */
export function bbox(points: readonly Point[]): [number, number, number, number] {
  if (points.length === 0) return [0, 0, 0, 0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

export function unionBbox(
  boxes: readonly [number, number, number, number][],
): [number, number, number, number] {
  if (boxes.length === 0) return [0, 0, 0, 0];
  let [minX, minY, maxX, maxY] = boxes[0]!;
  for (const [x0, y0, x1, y1] of boxes) {
    if (x0 < minX) minX = x0;
    if (y0 < minY) minY = y0;
    if (x1 > maxX) maxX = x1;
    if (y1 > maxY) maxY = y1;
  }
  return [minX, minY, maxX, maxY];
}
