/**
 * Dumps the CURRENT best-guess building/feature shapes (pixel coordinates on
 * the satellite photo) as JSON, so tools/campus-editor.html can pre-load them
 * for the user to drag into place rather than starting from a blank image.
 * This intentionally duplicates the pixel data in scripts/trace-aurak.ts —
 * both are throwaway authoring scripts, not shipped app code, so keeping
 * them decoupled is fine.
 */
import fs from "node:fs";
import path from "node:path";

import { rotatedRect } from "../src/domain/geometry/polygon";
import type { Point } from "../src/domain/geometry/vector";

const OUT = path.resolve(import.meta.dirname, "../tools/editor-shapes.json");

interface ShapeDef {
  id: string;
  label: string;
  points: Point[];
}

const CAMPUS_ANGLE_DEG = -78;
const MOSQUE_ANGLE_DEG = -48.7;

const rectShape = (id: string, label: string, center: Point, w: number, h: number, angleDeg: number): ShapeDef => ({
  id,
  label,
  points: rotatedRect(center, w, h, angleDeg) as unknown as Point[],
});

const circleShape = (id: string, label: string, center: Point, radiusPx: number, segments = 24): ShapeDef => ({
  id,
  label,
  points: Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return [center[0] + Math.cos(a) * radiusPx, center[1] + Math.sin(a) * radiusPx] as Point;
  }),
});

const shapes: ShapeDef[] = [
  rectShape("bldg-sports-hall", "10 · Sports Hall", [560, 490], 170, 220, CAMPUS_ANGLE_DEG),
  rectShape("bldg-warehouse", "13 · Warehouse and Stores", [465, 516], 79, 60, CAMPUS_ANGLE_DEG),
  rectShape("bldg-c", "7 · Recreation Hub", [758, 459], 147, 28, -73.6),
  rectShape("bldg-temp", "19 · Temporary Buildings", [500, 540], 240, 160, 0),
  rectShape("bldg-outdoor-comfort", "20 · RAK Center for Outdoor Comfort", [640, 560], 20, 20, CAMPUS_ANGLE_DEG),
  rectShape("bldg-g", "5 · School of Engineering and Computing", [988, 586], 101, 156, -81.3),
  rectShape("bldg-l", "6 · Engineering Labs", [910, 540], 50, 60, CAMPUS_ANGLE_DEG),
  rectShape("bldg-zeh", "18 · Zero Energy House", [950, 510], 20, 18, CAMPUS_ANGLE_DEG),
  rectShape("bldg-k", "4 · School of Arts and Sciences", [1243, 591], 77, 229, -84.4),
  circleShape("bldg-d", "8 · Admission and Registration", [818, 810], 38),
  rectShape("bldg-a", "9 · Student Life Hub", [701, 693], 51, 89, -76.6),
  rectShape("bldg-h", "2 · RAK Bank School of Business", [1073, 778], 42, 88, -71.6),
  rectShape("bldg-j", "3 · Saqr Library", [1209, 797], 50, 124, -78.7),
  rectShape("bldg-mosque", "17 · AURAK Mosque", [1299, 828], 93, 49, MOSQUE_ANGLE_DEG),
  rectShape("bldg-facilities-mgmt", "21 · Office of Facilities Management", [400, 715], 90, 45, 0),
  rectShape("bldg-admin", "22 · Admin Building", [490, 715], 90, 45, 0),
  rectShape("bldg-res-1", "15 · Residential Hall 1", [660, 800], 91, 207, -87.8),
  rectShape("bldg-res-2", "15 · Residential Hall 2", [570, 795], 70, 100, CAMPUS_ANGLE_DEG),
  rectShape("bldg-res-3", "15 · Residential Hall 3", [738, 795], 70, 100, CAMPUS_ANGLE_DEG),
  rectShape("bldg-res-4", "15 · Residential Hall 4", [898, 800], 90, 105, CAMPUS_ANGLE_DEG),
  rectShape("bldg-res-5", "15 · Residential Hall 5", [1018, 866], 79, 144, -90),
  rectShape("bldg-res-6", "15 · Residential Hall 6", [849, 840], 95, 160, -77.4),
  // Landscape features (non-building), included so the user can adjust these too.
  { id: "feat-boundary", label: "Campus boundary", points: [[400, 235], [1400, 290], [1430, 900], [395, 860]] },
  { id: "feat-track", label: "12/11 · Running track + field", points: [[405, 235], [755, 250], [755, 435], [405, 420]] },
  { id: "feat-parking", label: "16 · Student Parking", points: [[780, 340], [1080, 340], [1080, 460], [780, 460]] },
  { id: "feat-plaza", label: "Central plaza", points: [[1000, 560], [1250, 570], [1250, 700], [1000, 690]] },
  { id: "feat-lawn", label: "14 · Green Lawn", points: [[600, 460], [790, 460], [790, 560], [600, 555]] },
];

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(shapes, null, 2));
console.log(`Wrote ${shapes.length} shapes to ${OUT}`);
