/**
 * Squares up every hand-traced building quad in tools/aurak-trace.json into a
 * perfect rectangle (all corners exactly 90 deg), fit from the noisy corners
 * the editor's drag-to-draw/vertex-drag tools produced. Run once before
 * tracing pathways so the walkway graph anchors to clean building edges:
 *
 *   npx tsx scripts/regularize-trace.ts
 *
 * Leaves everything else untouched: circular/irregular shapes (Admission's
 * round footprint, the boundary, parking, fields) aren't rectangles by
 * design, so only 4-point shapes whose id starts with "bldg-" are touched.
 */
import fs from "node:fs";
import path from "node:path";

type Point = [number, number];

const TRACE_PATH = path.resolve(import.meta.dirname, "../tools/aurak-trace.json");

function sub(a: Point, b: Point): Point {
  return [a[0] - b[0], a[1] - b[1]];
}
function len(v: Point): number {
  return Math.hypot(v[0], v[1]);
}
function normalize(v: Point): Point {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l];
}

/** Best-fit rectangle through a noisy quad: same center, averaged edge lengths, one forced-perpendicular angle. */
function regularizeQuad(points: Point[]): Point[] {
  const [p0, p1, p2, p3] = points as [Point, Point, Point, Point];
  const center: Point = [
    (p0[0] + p1[0] + p2[0] + p3[0]) / 4,
    (p0[1] + p1[1] + p2[1] + p3[1]) / 4,
  ];

  const e0 = sub(p1, p0); // "width" edge
  const e2 = sub(p2, p3); // opposite width edge (same direction as e0 for a parallelogram)
  const e1 = sub(p2, p1); // "height" edge
  const e3 = sub(p3, p0); // opposite height edge

  const width = (len(e0) + len(e2)) / 2;
  const height = (len(e1) + len(e3)) / 2;

  const dir0 = normalize(e0);
  const dir2 = normalize(e2);
  const dir: Point = [dir0[0] + dir2[0], dir0[1] + dir2[1]];
  const angle = Math.atan2(dir[1], dir[0]);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hw = width / 2;
  const hh = height / 2;

  const corners: Point[] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];
  return corners.map(([x, y]): Point => [center[0] + x * cos - y * sin, center[1] + x * sin + y * cos]);
}

interface TraceShape {
  id: string;
  label: string;
  points: Point[];
}
const data: { imageWidth: number; imageHeight: number; shapes: TraceShape[] } = JSON.parse(
  fs.readFileSync(TRACE_PATH, "utf-8"),
);

let squared = 0;
for (const shape of data.shapes) {
  if (shape.id.startsWith("bldg-") && shape.points.length === 4) {
    shape.points = regularizeQuad(shape.points);
    squared++;
  }
}

fs.writeFileSync(TRACE_PATH, JSON.stringify(data, null, 2));
console.log(`Squared ${squared} building shapes in ${TRACE_PATH}`);
