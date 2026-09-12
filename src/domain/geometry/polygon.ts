import type { Point } from "@/domain/geometry/vector";

/**
 * Shoelace-formula signed area. Positive when the ring winds
 * clockwise in a y-down frame (i.e. "visually clockwise" on screen).
 */
export function signedArea(ring: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function area(ring: readonly Point[]): number {
  return Math.abs(signedArea(ring));
}

export function centroidOfPolygon(ring: readonly Point[]): Point {
  const a = signedArea(ring);
  if (Math.abs(a) < 1e-9 || ring.length < 3) {
    // Degenerate polygon: fall back to the average of vertices.
    let sx = 0;
    let sy = 0;
    for (const [x, y] of ring) {
      sx += x;
      sy += y;
    }
    return [sx / ring.length, sy / ring.length];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  const factor = 1 / (6 * a);
  return [cx * factor, cy * factor];
}

/** Ray-casting point-in-polygon test (outer ring only, no holes). */
export function pointInPolygon(point: Point, ring: readonly Point[]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersects =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Builds an axis-aligned rectangle centred at `center`, `w` (along `angleDeg`)
 * by `h` (perpendicular), rotated by `angleDeg` degrees. Useful for tracing
 * buildings that align with the site's long/short axes (see PLAN §4.5).
 */
export function rotatedRect(
  center: Point,
  w: number,
  h: number,
  angleDeg: number,
): [Point, Point, Point, Point] {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = w / 2;
  const hh = h / 2;
  const corners: Point[] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];
  const mapped = corners.map(
    ([x, y]): Point => [center[0] + x * cos - y * sin, center[1] + x * sin + y * cos],
  );
  return [mapped[0]!, mapped[1]!, mapped[2]!, mapped[3]!];
}
