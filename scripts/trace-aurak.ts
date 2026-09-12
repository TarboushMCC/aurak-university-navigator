/**
 * One-off authoring script (NOT part of the shipped app) that turns the hand-traced
 * pixel coordinates below (read off the reference picture, see docs/PLAN.md §4.6) into
 * the campus.json / map.json / buildings.json / places.json files under
 * src/campus-data/aurak/. Re-run after adjusting any pixel coordinate:
 *
 *   npx tsx scripts/trace-aurak.ts
 *
 * This is Claude's first-pass draft. It gets corrected against the user's review
 * of a rendered-map-vs-reference-picture screenshot (PLAN §4.6), then either this
 * script is re-run with fixes, or the /editor takes over for fine edits (Phase 1.5).
 */
import fs from "node:fs";
import path from "node:path";

import { applyH, solveHomography, type ControlPoint } from "../src/domain/geometry/homography";
import { rotatedRect } from "../src/domain/geometry/polygon";
import type { Point } from "../src/domain/geometry/vector";
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
// 1. Homography: reference-picture pixels -> map metres.
// ---------------------------------------------------------------------------

/** The 4 site-boundary corners, traced from the reference picture (image px). */
const SITE_CORNERS_PX = {
  n: [430, 8] as Point, // north tip
  e: [1215, 388] as Point, // east tip
  s: [788, 545] as Point, // south tip
  w: [12, 250] as Point, // west tip
};

/** Canonical map frame size in metres — an ESTIMATE from the football pitch (§4.2), not a survey. */
const MAP_LENGTH_M = 560; // N -> E axis
const MAP_WIDTH_M = 420; // N -> W axis

const controlPoints: ControlPoint[] = [
  { image: SITE_CORNERS_PX.n, map: [0, 0], label: "site-N" },
  { image: SITE_CORNERS_PX.e, map: [MAP_LENGTH_M, 0], label: "site-E" },
  { image: SITE_CORNERS_PX.s, map: [MAP_LENGTH_M, MAP_WIDTH_M], label: "site-S" },
  { image: SITE_CORNERS_PX.w, map: [0, MAP_WIDTH_M], label: "site-W" },
];

const H = solveHomography(controlPoints);
const toMap = (px: Point): Point => applyH(H, px);
const toMapRing = (ring: readonly Point[]): Point[] => ring.map(toMap);

// ---------------------------------------------------------------------------
// 2. Buildings — traced as a base-center pixel point (roof label position plus
//    an estimated downward correction for building height/parallax, see PLAN
//    §0 "roofs are displaced up and away from their ground position") and an
//    estimated footprint size. Most buildings are aligned to the campus grid,
//    which (by construction of the map frame) means axis-aligned rectangles
//    in map metres regardless of their skew in the picture.
// ---------------------------------------------------------------------------

interface BuildingSpec {
  id: string;
  code?: string;
  mapNumber?: number;
  name: string;
  aliases: string[];
  category: BuildingCategory;
  /** [pixelX, pixelY] roof-label position, then a downward pixel correction for height. */
  labelPx: Point;
  correctionDy: number;
  correctionDx?: number;
  /** Footprint size in metres along the map's x (L) and y (W) axes. */
  sizeM: [number, number];
  shape?: "rect" | "round";
  floors?: number[];
  heightM?: number;
}

const BUILDING_SPECS: BuildingSpec[] = [
  {
    id: "bldg-h",
    code: "H",
    mapNumber: 2,
    name: "RAK Bank School of Business",
    aliases: ["business school", "school of business", "rak bank"],
    category: "academic",
    labelPx: [960, 470],
    correctionDy: 35,
    sizeM: [42, 20],
    heightM: 14,
  },
  {
    id: "bldg-j",
    code: "J",
    mapNumber: 3,
    name: "Saqr Library",
    aliases: ["library", "main library", "saqr"],
    category: "academic",
    labelPx: [830, 436],
    correctionDy: 35,
    sizeM: [46, 22],
    heightM: 14,
  },
  {
    id: "bldg-k",
    code: "K",
    mapNumber: 4,
    name: "Abdullah Bin Ali Al Sharhan School of Arts and Sciences",
    aliases: ["arts and sciences", "school of arts and sciences", "al sharhan"],
    category: "academic",
    labelPx: [1095, 382],
    correctionDy: 35,
    sizeM: [40, 24],
    heightM: 14,
  },
  {
    id: "bldg-g",
    code: "G",
    mapNumber: 5,
    name: "School of Engineering and Computing",
    aliases: ["engineering", "computing", "school of engineering"],
    category: "academic",
    labelPx: [805, 325],
    correctionDy: 40,
    sizeM: [46, 34],
    heightM: 15,
  },
  {
    id: "bldg-l",
    code: "L",
    mapNumber: 6,
    name: "Engineering Labs",
    aliases: ["labs", "engineering labs"],
    category: "academic",
    labelPx: [885, 290],
    correctionDy: 30,
    sizeM: [34, 18],
    heightM: 10,
  },
  {
    id: "bldg-c",
    code: "C",
    mapNumber: 7,
    name: "Recreation Hub",
    aliases: ["recreation", "recreation hub"],
    category: "facilities",
    labelPx: [588, 232],
    correctionDy: 25,
    sizeM: [95, 15],
    heightM: 8,
  },
  {
    id: "bldg-d",
    code: "D",
    mapNumber: 8,
    name: "Admission and Registration",
    aliases: ["admission", "registration", "admissions"],
    category: "services",
    labelPx: [535, 410],
    correctionDy: 22,
    sizeM: [22, 22],
    shape: "round",
    heightM: 9,
  },
  {
    id: "bldg-a",
    code: "A",
    mapNumber: 9,
    name: "Student Life Hub",
    aliases: ["student life", "student life hub"],
    category: "services",
    labelPx: [445, 318],
    correctionDy: 22,
    sizeM: [30, 30],
    shape: "round",
    heightM: 9,
  },
  {
    id: "bldg-sports-hall",
    mapNumber: 10,
    name: "Sports Hall",
    aliases: ["sports hall", "gym"],
    category: "sports",
    labelPx: [338, 158],
    correctionDy: 25,
    sizeM: [40, 22],
    heightM: 10,
  },
  {
    id: "bldg-warehouse",
    mapNumber: 13,
    name: "Warehouse and Stores",
    aliases: ["warehouse", "stores"],
    category: "facilities",
    labelPx: [283, 183],
    correctionDy: 15,
    sizeM: [26, 15],
    heightM: 7,
  },
  {
    id: "bldg-mosque",
    mapNumber: 17,
    name: "AURAK Mosque",
    aliases: ["mosque", "masjid", "prayer room"],
    category: "landmark",
    labelPx: [757, 488],
    correctionDy: 30,
    sizeM: [22, 18],
    heightM: 12,
  },
  {
    id: "bldg-zeh",
    mapNumber: 18,
    name: "Zero Energy House (Solar Decathlon)",
    aliases: ["zero energy house", "solar decathlon"],
    category: "landmark",
    labelPx: [952, 310],
    correctionDy: 30,
    sizeM: [16, 14],
    heightM: 6,
  },
  {
    id: "bldg-temp",
    mapNumber: 19,
    name: "Temporary Buildings",
    aliases: ["temporary buildings"],
    category: "facilities",
    labelPx: [490, 210],
    correctionDy: 20,
    sizeM: [34, 16],
    heightM: 6,
  },
  {
    id: "bldg-outdoor-comfort",
    mapNumber: 20,
    name: "RAK Center for Outdoor Comfort",
    aliases: ["outdoor comfort", "outdoor comfort center"],
    category: "landmark",
    labelPx: [540, 203],
    correctionDy: 15,
    sizeM: [14, 14],
    heightM: 6,
  },
  {
    id: "bldg-facilities-mgmt",
    mapNumber: 21,
    name: "Office of Facilities Management",
    aliases: ["facilities management"],
    category: "facilities",
    labelPx: [278, 318],
    correctionDy: 20,
    sizeM: [20, 14],
    heightM: 7,
  },
  {
    id: "bldg-admin",
    mapNumber: 22,
    name: "Admin Building",
    aliases: ["admin", "administration"],
    category: "facilities",
    labelPx: [322, 350],
    correctionDy: 22,
    sizeM: [22, 16],
    heightM: 8,
  },
];

/** Student Residential Halls 1-6 (legend item 15 covers all six as one group). */
const RESIDENCE_LABELS_PX: Point[] = [
  [905, 550], // 1
  [833, 525], // 2
  [695, 470], // 3
  [607, 437], // 4
  [460, 380], // 5
  [380, 358], // 6
];
for (const [i, labelPx] of RESIDENCE_LABELS_PX.entries()) {
  const n = i + 1;
  BUILDING_SPECS.push({
    id: `bldg-res-${n}`,
    name: `Residential Hall ${n}`,
    aliases: [`residence ${n}`, `dorm ${n}`, "residential halls", "dorms", "student housing"],
    category: "residence",
    labelPx,
    correctionDy: 45,
    sizeM: [18, 16],
    heightM: 24,
  });
}

// ---------------------------------------------------------------------------
// 3. Landscape / hardscape features (roads, parking, lawns, fields, plaza).
// ---------------------------------------------------------------------------

/** Insets a quadrilateral toward its own centroid by a fraction (0-1). Used for a simple ring-road shape. */
function insetQuad(ring: Point[], fraction: number): Point[] {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return ring.map(([x, y]) => [x + (cx - x) * fraction, y + (cy - y) * fraction]);
}

const boundaryPx: Point[] = [
  SITE_CORNERS_PX.n,
  SITE_CORNERS_PX.e,
  SITE_CORNERS_PX.s,
  SITE_CORNERS_PX.w,
];

// Perimeter road: a ring between the boundary and a slightly-inset ring.
const roadOuterPx = boundaryPx;
const roadInnerPx = insetQuad(boundaryPx, 0.09);

// Two "Future Expansion" zones, visible as tan hatched areas along the NW and SE edges.
const futureZoneNwPx: Point[] = [
  [12, 250],
  [430, 8],
  [330, 175],
  [150, 300],
];
const futureZoneSePx: Point[] = [
  [900, 315],
  [1215, 388],
  [788, 545],
  [700, 480],
];

// Student parking lot (16), traced from its visible trapezoid near the NE road bend.
const parkingPx: Point[] = [
  [705, 150],
  [1065, 205],
  [985, 335],
  [715, 275],
];

// Green Lawn (14): the wide planted promenade between the Student Life Hub (9) and the library (3).
const lawnPx: Point[] = [
  [470, 265],
  [640, 235],
  [790, 330],
  [760, 420],
  [610, 400],
  [500, 340],
];

// Football pitch (12), traced corners (see docs/PLAN §0); track is an offset ring around it.
const pitchPx: Point[] = [
  [449, 59],
  [601, 116],
  [533, 165],
  [386, 104],
];

// Sports courts (11), the pinwheel-paved area next to the Sports Hall.
const courtsPx: Point[] = [
  [392, 118],
  [432, 133],
  [412, 168],
  [372, 153],
];

// Central plaza: the paved area around the round pavilion between buildings 3/4/8/9.
const plazaPx: Point[] = [
  [860, 330],
  [1020, 355],
  [990, 430],
  [830, 405],
];

const plazaPavilionCenterPx: Point = [970, 395];
const outdoorComfortCanopyPx: Point = [368, 148];

const gatePx: Point = [878, 555];

// ---------------------------------------------------------------------------
// 4. Build map.json features.
// ---------------------------------------------------------------------------

const features: MapFeature[] = [];
let featureCounter = 0;
const nextId = (prefix: string) => `${prefix}-${(featureCounter++).toString(36)}`;

features.push({
  id: nextId("boundary"),
  layer: "boundary",
  geometry: { type: "Polygon", coordinates: [toMapRing(boundaryPx)] },
});

features.push({
  id: nextId("future"),
  layer: "future_zone",
  geometry: { type: "Polygon", coordinates: [toMapRing(futureZoneNwPx)] },
  label: "Future Expansion",
});
features.push({
  id: nextId("future"),
  layer: "future_zone",
  geometry: { type: "Polygon", coordinates: [toMapRing(futureZoneSePx)] },
  label: "Future Expansion",
});

// Perimeter road as a ring: outer boundary ring + inner ring as a hole
// (rendered with fillRule="evenodd", see RoadsLayer).
features.push({
  id: nextId("road"),
  layer: "road",
  geometry: {
    type: "Polygon",
    coordinates: [toMapRing(roadOuterPx), toMapRing(roadInnerPx)],
  },
});

features.push({
  id: nextId("parking"),
  layer: "parking",
  geometry: { type: "Polygon", coordinates: [toMapRing(parkingPx)] },
  label: "Student Parking",
});

features.push({
  id: nextId("lawn"),
  layer: "lawn",
  geometry: { type: "Polygon", coordinates: [toMapRing(lawnPx)] },
  label: "Green Lawn",
});

features.push({
  id: nextId("field"),
  layer: "field",
  geometry: { type: "Polygon", coordinates: [toMapRing(pitchPx)] },
  variant: "football",
  label: "Football Field",
});

features.push({
  id: nextId("court"),
  layer: "court",
  geometry: { type: "Polygon", coordinates: [toMapRing(courtsPx)] },
  variant: "courts",
  label: "Sports Fields",
});

features.push({
  id: nextId("plaza"),
  layer: "plaza",
  geometry: { type: "Polygon", coordinates: [toMapRing(plazaPx)] },
});

features.push({
  id: nextId("canopy"),
  layer: "canopy",
  geometry: { type: "Point", coordinates: toMap(plazaPavilionCenterPx) },
  variant: "round",
  label: "Central Plaza Pavilion",
});
features.push({
  id: nextId("canopy"),
  layer: "canopy",
  geometry: { type: "Point", coordinates: toMap(outdoorComfortCanopyPx) },
  variant: "shade_sails",
});

features.push({
  id: nextId("gate"),
  layer: "gate",
  geometry: { type: "Point", coordinates: toMap(gatePx) },
  label: "AURAK Main Gate",
});

// Buildings.
const buildings: Building[] = [];
for (const spec of BUILDING_SPECS) {
  const basePx: Point = [
    spec.labelPx[0] + (spec.correctionDx ?? 0),
    spec.labelPx[1] + spec.correctionDy,
  ];
  const centerMap = toMap(basePx);
  const [w, d] = spec.sizeM;
  const ring =
    spec.shape === "round"
      ? // Approximate a round building as a 12-sided polygon.
        Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const r = w / 2;
          return [centerMap[0] + Math.cos(a) * r, centerMap[1] + Math.sin(a) * r] as Point;
        })
      : rotatedRect(centerMap, w, d, 0);

  features.push({
    id: `feat-${spec.id}`,
    layer: "building",
    geometry: { type: "Polygon", coordinates: [ring] },
    buildingId: spec.id,
    heightM: spec.heightM,
  });

  buildings.push({
    id: spec.id,
    code: spec.code,
    mapNumber: spec.mapNumber,
    name: spec.name,
    aliases: spec.aliases,
    floors: spec.floors ?? [0],
    category: spec.category,
    heightM: spec.heightM,
    labelAt: centerMap,
  });
}

// A handful of trees scattered near the promenade and parking edges for visual texture
// (not traced precisely — decorative only, see PLAN §4.4 item 9).
const treeSeedPx: Point[] = [
  [420, 60], [460, 70], [500, 85], [540, 95], [580, 108], // along the field's north path
  [300, 130], [280, 145], [260, 165], // NW path
  [420, 260], [450, 275], [480, 290], [560, 300], [600, 310], [650, 320], [690, 335], [730, 350], // lawn promenade
  [500, 350], [530, 365], [560, 380], // lawn south edge
  [820, 380], [850, 395], [880, 405], [910, 385], [940, 370], // plaza trees
  [100, 300], [140, 320], [180, 340], [220, 360], [260, 300], // SW walkway
  [1000, 250], [1030, 270], // parking edge
];
for (const px of treeSeedPx) {
  features.push({
    id: nextId("tree"),
    layer: "tree",
    geometry: { type: "Point", coordinates: toMap(px) },
  });
}

const mapData: CampusMapData = {
  levelId: "ground",
  bounds: { width: MAP_LENGTH_M, height: MAP_WIDTH_M },
  features,
};

// ---------------------------------------------------------------------------
// 5. Places (searchable/navigable entities). v1 scope: buildings + a few
//    non-building landmarks. Rooms are a future feature (PLAN §3.5).
// ---------------------------------------------------------------------------

const places: Place[] = [];
for (const b of BUILDING_SPECS) {
  const type: PlaceType =
    b.category === "residence"
      ? "residence"
      : b.category === "sports"
        ? "sports"
        : b.category === "services"
          ? "service"
          : b.category === "landmark"
            ? "landmark"
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
places.push({
  id: "place.gate1",
  type: "gate",
  name: "AURAK Main Gate",
  aliases: ["gate 1", "main gate", "entrance"],
  anchors: [],
  startable: true,
  mapNumber: 1,
});
places.push({
  id: "place.parking",
  type: "parking",
  name: "Student Parking",
  aliases: ["parking", "car park"],
  anchors: [],
  startable: true,
  mapNumber: 16,
});
places.push({
  id: "place.green-lawn",
  type: "landmark",
  name: "Green Lawn",
  aliases: ["lawn", "the lawn", "central lawn"],
  anchors: [],
  startable: true,
  mapNumber: 14,
});
places.push({
  id: "place.football-field",
  type: "sports",
  name: "Football Field",
  aliases: ["football field", "pitch", "stadium"],
  anchors: [],
  startable: true,
  mapNumber: 12,
});
places.push({
  id: "place.sports-fields",
  type: "sports",
  name: "Sports Fields",
  aliases: ["sports fields", "courts"],
  anchors: [],
  startable: true,
  mapNumber: 11,
});

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

const levels = [
  {
    id: "ground",
    name: "Campus (outdoor)",
    kind: "site" as const,
    bounds: { width: MAP_LENGTH_M, height: MAP_WIDTH_M },
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "campus.json"), JSON.stringify({ campus, levels }, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "map.json"), JSON.stringify(mapData, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "buildings.json"), JSON.stringify(buildings, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "places.json"), JSON.stringify(places, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "nodes.json"), JSON.stringify([], null, 2));
fs.writeFileSync(path.join(OUT_DIR, "edges.json"), JSON.stringify([], null, 2));

console.log(`Wrote ${buildings.length} buildings, ${features.length} map features, ${places.length} places to ${OUT_DIR}`);
console.log(`Map bounds: ${MAP_LENGTH_M}m x ${MAP_WIDTH_M}m`);
