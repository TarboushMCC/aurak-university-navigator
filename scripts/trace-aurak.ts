/**
 * One-off authoring script (NOT part of the shipped app) that turns traced
 * coordinates into campus.json / map.json / buildings.json / places.json
 * under src/campus-data/aurak/. Re-run after adjusting anything below:
 *
 *   npx tsx scripts/trace-aurak.ts
 *
 * Tracing method (v3 — traced from a real satellite photo, not the
 * illustration):
 *
 *  v1/v2 traced building corners from the user's isometric illustration and
 *  ran them through a homography to correct the perspective. That worked,
 *  but every corner pick carried some hand-tracing error, and the source
 *  itself was a stylised, not-to-scale illustration.
 *
 *  v3 instead traces directly from a real satellite photo of the actual
 *  campus (ArcGIS World Imagery, centred on AURAK's published coordinates,
 *  25.7887°N 55.99381°E — see src/campus-data/aurak/reference/
 *  campus-satellite.png). Being a true nadir (straight-down) photo, there is
 *  no perspective to correct and no roof-vs-base offset to estimate: pixels
 *  convert to map metres by a simple, accurate geographic scale. Building
 *  rectangles were found with OpenCV (brightness threshold + minAreaRect on
 *  each connected component), then matched to the illustration's 22 numbered
 *  places by position; a few small utility buildings (6, 18, 19, 20, 21)
 *  couldn't be identified with full confidence on the photo and are
 *  approximate (flagged inline below).
 */
import fs from "node:fs";
import path from "node:path";

import type { Point } from "../src/domain/geometry/vector";
import { rotatedRect } from "../src/domain/geometry/polygon";
import type {
  Building,
  BuildingCategory,
  CampusMapData,
  MapFeature,
  Place,
  PlaceType,
} from "../src/domain/schema";

const OUT_DIR = path.resolve(import.meta.dirname, "../src/campus-data/aurak");

// ---------------------------------------------------------------------------
// 1. Geo scale: satellite-image pixels -> map metres.
// ---------------------------------------------------------------------------

/** The bbox used to fetch reference/campus-satellite.png (EPSG:4326). */
const SAT_BBOX = { lon0: 55.9895, lat0: 25.7862, lon1: 55.9985, lat1: 25.7915 };
const SAT_SIZE = { width: 1800, height: 1145 };

const EARTH_M_PER_DEG_LAT = 111320;
const latMid = (SAT_BBOX.lat0 + SAT_BBOX.lat1) / 2;
const earthMPerDegLon = EARTH_M_PER_DEG_LAT * Math.cos((latMid * Math.PI) / 180);

/** Metres per satellite pixel, x and y (not quite equal — the fetch bbox wasn't pixel-perfectly square). */
const MX = ((SAT_BBOX.lon1 - SAT_BBOX.lon0) / SAT_SIZE.width) * earthMPerDegLon;
const MY = ((SAT_BBOX.lat1 - SAT_BBOX.lat0) / SAT_SIZE.height) * EARTH_M_PER_DEG_LAT;

// The satellite fetch covers more than just the campus (neighbouring streets,
// desert). Re-origin map metres to the campus boundary's own top-left corner
// so the rendered map frames the campus itself, not a mostly-empty image.
const BOUNDARY_ORIGIN_PX: Point = [390, 230];

/** Satellite pixel -> map metres, origin at the campus boundary's top-left corner. */
const toMap = ([x, y]: Point): Point => [
  (x - BOUNDARY_ORIGIN_PX[0]) * MX,
  (y - BOUNDARY_ORIGIN_PX[1]) * MY,
];
const toMapRing = (ring: readonly Point[]): Point[] => ring.map(toMap);

const MAP_LENGTH_M = (1435 - BOUNDARY_ORIGIN_PX[0]) * MX; // campus boundary bbox width, padded
const MAP_WIDTH_M = (905 - BOUNDARY_ORIGIN_PX[1]) * MY; // campus boundary bbox height, padded

/**
 * Builds a clean map-space rectangle from a satellite-pixel center/size/angle
 * (as produced by cv2.minAreaRect or estimated by eye). Unlike the v1/v2
 * illustration trace, no roof-vs-base correction or noise regularisation is
 * needed here — a nadir photo's roof outline already is the footprint, and
 * OpenCV's minAreaRect already gives a clean rectangle.
 */
function footprintFromPx(centerPx: Point, wPx: number, hPx: number, angleDeg: number): Point[] {
  const centerMap = toMap(centerPx);
  // Approximate: scale w/h by the average of MX/MY (they're within ~3% of
  // each other) rather than stretching a rotated rect non-uniformly.
  const avgScale = (MX + MY) / 2;
  return rotatedRect(centerMap, wPx * avgScale, hPx * avgScale, angleDeg);
}

function circleFootprint(centerPx: Point, radiusPx: number, segments = 24): Point[] {
  const centerMap = toMap(centerPx);
  const avgScale = (MX + MY) / 2;
  const radiusM = radiusPx * avgScale;
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return [centerMap[0] + Math.cos(a) * radiusM, centerMap[1] + Math.sin(a) * radiusM] as Point;
  });
}

// ---------------------------------------------------------------------------
// 2. Buildings, traced from the satellite photo (pixel center/size/angle).
// ---------------------------------------------------------------------------

interface BuildingSpec {
  id: string;
  code?: string;
  mapNumber?: number;
  name: string;
  aliases: string[];
  category: BuildingCategory;
  heightM: number;
  rectPx?: { center: Point; w: number; h: number; angleDeg: number };
  circlePx?: { center: Point; radiusPx: number };
  /** Set for buildings whose satellite identity is a best guess, not confirmed. */
  approximate?: boolean;
}

const CAMPUS_ANGLE_DEG = -78; // dominant building rotation measured across the photo (OpenCV convention)
const MOSQUE_ANGLE_DEG = -48.7; // mosques face Mecca, not the campus grid — genuinely a different angle

const BUILDING_SPECS: BuildingSpec[] = [
  {
    id: "bldg-sports-hall",
    mapNumber: 10,
    name: "Sports Hall",
    aliases: ["sports hall", "gym"],
    category: "sports",
    heightM: 9,
    rectPx: { center: [560, 490], w: 170, h: 220, angleDeg: CAMPUS_ANGLE_DEG },
  },
  {
    id: "bldg-warehouse",
    mapNumber: 13,
    name: "Warehouse and Stores",
    aliases: ["warehouse", "stores"],
    category: "facilities",
    heightM: 6,
    rectPx: { center: [465, 516], w: 79, h: 60, angleDeg: CAMPUS_ANGLE_DEG },
  },
  {
    id: "bldg-c",
    code: "C",
    mapNumber: 7,
    name: "Recreation Hub",
    aliases: ["recreation", "recreation hub"],
    category: "facilities",
    heightM: 7,
    rectPx: { center: [758, 459], w: 147, h: 28, angleDeg: -73.6 },
  },
  {
    id: "bldg-temp",
    mapNumber: 19,
    name: "Temporary Buildings",
    aliases: ["temporary buildings"],
    category: "facilities",
    heightM: 6,
    // The large notched/courtyard building south of the sports complex.
    rectPx: { center: [500, 540], w: 240, h: 160, angleDeg: 0 },
  },
  {
    id: "bldg-outdoor-comfort",
    mapNumber: 20,
    name: "RAK Center for Outdoor Comfort",
    aliases: ["outdoor comfort", "outdoor comfort center"],
    category: "landmark",
    heightM: 5,
    rectPx: { center: [640, 560], w: 20, h: 20, angleDeg: CAMPUS_ANGLE_DEG },
    approximate: true,
  },
  {
    id: "bldg-g",
    code: "G",
    mapNumber: 5,
    name: "School of Engineering and Computing",
    aliases: ["engineering", "computing", "school of engineering"],
    category: "academic",
    heightM: 15,
    rectPx: { center: [988, 586], w: 101, h: 156, angleDeg: -81.3 },
  },
  {
    id: "bldg-l",
    code: "L",
    mapNumber: 6,
    name: "Engineering Labs",
    aliases: ["labs", "engineering labs"],
    category: "academic",
    heightM: 9,
    rectPx: { center: [910, 540], w: 50, h: 60, angleDeg: CAMPUS_ANGLE_DEG },
    approximate: true,
  },
  {
    id: "bldg-zeh",
    mapNumber: 18,
    name: "Zero Energy House (Solar Decathlon)",
    aliases: ["zero energy house", "solar decathlon"],
    category: "landmark",
    heightM: 6,
    rectPx: { center: [950, 510], w: 20, h: 18, angleDeg: CAMPUS_ANGLE_DEG },
    approximate: true,
  },
  {
    id: "bldg-k",
    code: "K",
    mapNumber: 4,
    name: "Abdullah Bin Ali Al Sharhan School of Arts and Sciences",
    aliases: ["arts and sciences", "school of arts and sciences", "al sharhan"],
    category: "academic",
    heightM: 14,
    rectPx: { center: [1243, 591], w: 77, h: 229, angleDeg: -84.4 },
  },
  {
    id: "bldg-d",
    code: "D",
    mapNumber: 8,
    name: "Admission and Registration",
    aliases: ["admission", "registration", "admissions"],
    category: "services",
    heightM: 9,
    circlePx: { center: [818, 810], radiusPx: 38 },
  },
  {
    id: "bldg-a",
    code: "A",
    mapNumber: 9,
    name: "Student Life Hub",
    aliases: ["student life", "student life hub"],
    category: "services",
    heightM: 10,
    rectPx: { center: [701, 693], w: 51, h: 89, angleDeg: -76.6 },
    approximate: true,
  },
  {
    id: "bldg-h",
    code: "H",
    mapNumber: 2,
    name: "RAK Bank School of Business",
    aliases: ["business school", "school of business", "rak bank"],
    category: "academic",
    heightM: 14,
    rectPx: { center: [1073, 778], w: 42, h: 88, angleDeg: -71.6 },
  },
  {
    id: "bldg-j",
    code: "J",
    mapNumber: 3,
    name: "Saqr Library",
    aliases: ["library", "main library", "saqr"],
    category: "academic",
    heightM: 14,
    rectPx: { center: [1209, 797], w: 50, h: 124, angleDeg: -78.7 },
  },
  {
    id: "bldg-mosque",
    mapNumber: 17,
    name: "AURAK Mosque",
    aliases: ["mosque", "masjid", "prayer room"],
    category: "landmark",
    heightM: 10,
    // Distinctly rotated relative to the campus grid on the photo — mosques
    // are oriented toward Mecca (qibla), not the surrounding street grid.
    rectPx: { center: [1299, 828], w: 93, h: 49, angleDeg: MOSQUE_ANGLE_DEG },
  },
  {
    id: "bldg-facilities-mgmt",
    mapNumber: 21,
    name: "Office of Facilities Management",
    aliases: ["facilities management"],
    category: "facilities",
    heightM: 6,
    rectPx: { center: [400, 715], w: 90, h: 45, angleDeg: 0 },
    approximate: true,
  },
  {
    id: "bldg-admin",
    mapNumber: 22,
    name: "Admin Building",
    aliases: ["admin", "administration"],
    category: "facilities",
    heightM: 7,
    rectPx: { center: [490, 715], w: 90, h: 45, angleDeg: 0 },
    approximate: true,
  },
];

const RESIDENCE_RECTS_PX: { center: Point; w: number; h: number; angleDeg: number }[] = [
  { center: [660, 800], w: 91, h: 207, angleDeg: -87.8 },
  { center: [570, 795], w: 70, h: 100, angleDeg: CAMPUS_ANGLE_DEG },
  { center: [738, 795], w: 70, h: 100, angleDeg: CAMPUS_ANGLE_DEG },
  { center: [898, 800], w: 90, h: 105, angleDeg: CAMPUS_ANGLE_DEG },
  { center: [1018, 866], w: 79, h: 144, angleDeg: -90 },
  { center: [849, 840], w: 95, h: 160, angleDeg: -77.4 },
];
for (const [i, rectPx] of RESIDENCE_RECTS_PX.entries()) {
  const n = i + 1;
  BUILDING_SPECS.push({
    id: `bldg-res-${n}`,
    name: `Residential Hall ${n}`,
    aliases: [`residence ${n}`, `dorm ${n}`, "residential halls", "dorms", "student housing"],
    category: "residence",
    heightM: 16,
    rectPx,
  });
}

// ---------------------------------------------------------------------------
// 3. Landscape / hardscape, also traced from the satellite photo.
// ---------------------------------------------------------------------------

const boundaryPx: Point[] = [
  [400, 235],
  [1400, 290],
  [1430, 900],
  [395, 860],
];

function insetQuad(ring: Point[], fraction: number): Point[] {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return ring.map(([x, y]): Point => [x + (cx - x) * fraction, y + (cy - y) * fraction]);
}

const roadOuterPx = boundaryPx;
const roadInnerPx = insetQuad(boundaryPx, 0.09);

const futureZonePx: Point[] = [
  [1150, 250],
  [1400, 290],
  [1400, 550],
  [1150, 500],
];

const parkingPx: Point[] = [
  [780, 340],
  [1080, 340],
  [1080, 460],
  [780, 460],
];

// The running track (outer red rubber ring) around the dark-green field.
const pitchPx: Point[] = [
  [405, 235],
  [755, 250],
  [755, 435],
  [405, 420],
];

const courtsPx: Point[] = [
  [420, 460],
  [560, 465],
  [555, 590],
  [415, 585],
];

const plazaPx: Point[] = [
  [1000, 560],
  [1250, 570],
  [1250, 700],
  [1000, 690],
];

const plazaPavilionCenterPx: Point = [1155, 630];
const gatePx: Point = [500, 860];

// Green Lawn: the dark planted courtyard/garden strip that actually shows up
// on the photo, between the sports complex and the main academic cluster.
const lawnPx: Point[] = [
  [600, 460],
  [790, 460],
  [790, 560],
  [600, 555],
];

// ---------------------------------------------------------------------------
// 4. Build map.json features.
// ---------------------------------------------------------------------------

const features: MapFeature[] = [];
let featureCounter = 0;
const nextId = (prefix: string) => `${prefix}-${(featureCounter++).toString(36)}`;

features.push({ id: nextId("boundary"), layer: "boundary", geometry: { type: "Polygon", coordinates: [toMapRing(boundaryPx)] } });
features.push({ id: nextId("future"), layer: "future_zone", geometry: { type: "Polygon", coordinates: [toMapRing(futureZonePx)] }, label: "Future Expansion" });

features.push({
  id: nextId("road"),
  layer: "road",
  geometry: { type: "Polygon", coordinates: [toMapRing(roadOuterPx), toMapRing(roadInnerPx)] },
});
for (let i = 0; i < 4; i++) {
  const outerA = roadOuterPx[i]!;
  const outerB = roadOuterPx[(i + 1) % 4]!;
  const innerA = roadInnerPx[i]!;
  const innerB = roadInnerPx[(i + 1) % 4]!;
  const midA: Point = [(outerA[0] + innerA[0]) / 2, (outerA[1] + innerA[1]) / 2];
  const midB: Point = [(outerB[0] + innerB[0]) / 2, (outerB[1] + innerB[1]) / 2];
  features.push({ id: nextId("roadmark"), layer: "road_marking", geometry: { type: "LineString", coordinates: [toMap(midA), toMap(midB)] } });
}

features.push({ id: nextId("parking"), layer: "parking", geometry: { type: "Polygon", coordinates: [toMapRing(parkingPx)] }, label: "Student Parking" });
features.push({ id: nextId("lawn"), layer: "lawn", geometry: { type: "Polygon", coordinates: [toMapRing(lawnPx)] }, label: "Green Lawn" });
features.push({ id: nextId("field"), layer: "field", geometry: { type: "Polygon", coordinates: [toMapRing(pitchPx)] }, variant: "football", label: "Football Field" });
features.push({ id: nextId("court"), layer: "court", geometry: { type: "Polygon", coordinates: [toMapRing(courtsPx)] }, variant: "courts", label: "Sports Fields" });
features.push({ id: nextId("plaza"), layer: "plaza", geometry: { type: "Polygon", coordinates: [toMapRing(plazaPx)] } });
features.push({ id: nextId("canopy"), layer: "canopy", geometry: { type: "Point", coordinates: toMap(plazaPavilionCenterPx) }, variant: "round", label: "Central Plaza Pavilion" });
features.push({ id: nextId("gate"), layer: "gate", geometry: { type: "Point", coordinates: toMap(gatePx) }, label: "AURAK Main Gate" });

const buildings: Building[] = [];
for (const spec of BUILDING_SPECS) {
  const ring = spec.circlePx
    ? circleFootprint(spec.circlePx.center, spec.circlePx.radiusPx)
    : footprintFromPx(spec.rectPx!.center, spec.rectPx!.w, spec.rectPx!.h, spec.rectPx!.angleDeg);

  features.push({
    id: `feat-${spec.id}`,
    layer: "building",
    geometry: { type: "Polygon", coordinates: [ring] },
    buildingId: spec.id,
    heightM: spec.heightM,
  });

  const centroid: Point = [
    ring.reduce((s, p) => s + p[0], 0) / ring.length,
    ring.reduce((s, p) => s + p[1], 0) / ring.length,
  ];

  buildings.push({
    id: spec.id,
    code: spec.code,
    mapNumber: spec.mapNumber,
    name: spec.name,
    aliases: spec.aliases,
    floors: [0],
    category: spec.category,
    heightM: spec.heightM,
    labelAt: centroid,
  });
}

const treeSeedPx: Point[] = [
  [420, 260], [460, 270], [500, 285], [540, 295], [580, 305],
  [300, 330], [280, 345], [260, 365],
  [650, 470], [680, 480], [720, 490],
  [1000, 720], [1030, 730], [1060, 715],
  [900, 700], [930, 690],
  [200, 680], [230, 700], [260, 720],
  [1200, 460], [1230, 470],
];
for (const px of treeSeedPx) {
  features.push({ id: nextId("tree"), layer: "tree", geometry: { type: "Point", coordinates: toMap(px) } });
}

const mapData: CampusMapData = { levelId: "ground", bounds: { width: MAP_LENGTH_M, height: MAP_WIDTH_M }, features };

// ---------------------------------------------------------------------------
// 5. Places.
// ---------------------------------------------------------------------------

const places: Place[] = [];
for (const b of BUILDING_SPECS) {
  const type: PlaceType =
    b.category === "residence" ? "residence"
    : b.category === "sports" ? "sports"
    : b.category === "services" ? "service"
    : b.category === "landmark" ? "landmark"
    : "building";
  places.push({
    id: `place.${b.id.replace(/^bldg-/, "")}`,
    type,
    name: b.name,
    buildingId: b.id,
    aliases: b.aliases,
    anchors: [],
    startable: true,
    mapNumber: b.mapNumber,
  });
}
places.push({ id: "place.gate1", type: "gate", name: "AURAK Main Gate", aliases: ["gate 1", "main gate", "entrance"], anchors: [], startable: true, mapNumber: 1 });
places.push({ id: "place.parking", type: "parking", name: "Student Parking", aliases: ["parking", "car park"], anchors: [], startable: true, mapNumber: 16 });
places.push({ id: "place.green-lawn", type: "landmark", name: "Green Lawn", aliases: ["lawn", "the lawn", "central lawn"], anchors: [], startable: true, mapNumber: 14 });
places.push({ id: "place.football-field", type: "sports", name: "Football Field", aliases: ["football field", "pitch", "stadium"], anchors: [], startable: true, mapNumber: 12 });
places.push({ id: "place.sports-fields", type: "sports", name: "Sports Fields", aliases: ["sports fields", "courts"], anchors: [], startable: true, mapNumber: 11 });

// ---------------------------------------------------------------------------
// 6. Write files.
// ---------------------------------------------------------------------------

const campus = {
  id: "aurak",
  name: "American University of Ras Al Khaimah",
  shortName: "AURAK",
  defaultLevelId: "ground",
  walkingSpeedMps: { default: 1.3, accessible: 1.0 },
};
const levels = [{ id: "ground", name: "Campus (outdoor)", kind: "site" as const, bounds: { width: MAP_LENGTH_M, height: MAP_WIDTH_M } }];

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "campus.json"), JSON.stringify({ campus, levels }, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "map.json"), JSON.stringify(mapData, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "buildings.json"), JSON.stringify(buildings, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "places.json"), JSON.stringify(places, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "nodes.json"), JSON.stringify([], null, 2));
fs.writeFileSync(path.join(OUT_DIR, "edges.json"), JSON.stringify([], null, 2));

console.log(
  `Wrote ${buildings.length} buildings, ${features.length} map features, ${places.length} places to ${OUT_DIR}`,
);
console.log(`Campus bbox: ${MAP_LENGTH_M.toFixed(0)}m x ${MAP_WIDTH_M.toFixed(0)}m (full fetched image)`);
const approx = BUILDING_SPECS.filter((b) => b.approximate).map((b) => b.name);
if (approx.length) console.log(`Approximate placements (flagged, not satellite-confirmed): ${approx.join(", ")}`);
