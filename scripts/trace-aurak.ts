/**
 * One-off authoring script (NOT part of the shipped app) that turns hand- and
 * algorithmically-traced pixel coordinates from the reference picture (see
 * docs/PLAN.md §4.6) into campus.json / map.json / buildings.json /
 * places.json under src/campus-data/aurak/. Re-run after adjusting any pixel
 * coordinate below:
 *
 *   npx tsx scripts/trace-aurak.ts
 *
 * Tracing method (v2 — corrected after the v1 draft was rejected as
 * inaccurate):
 *  1. Each building's ROOF quad is traced from the reference picture — either
 *     algorithmically (connected-component + extreme-point corner detection
 *     on the roof's brightness-neutral pixels, for buildings with clean
 *     contrast against the ground) or, where that's unreliable (buildings
 *     abutting parking/lawn of a similar tone, or round buildings), read
 *     directly off zoomed, gridded crops of the picture.
 *  2. Roofs sit ABOVE their true ground footprint in this picture's
 *     perspective (see docs/PLAN.md §0). Verticals in this render project as
 *     near-vertical screen lines, so each roof quad is shifted straight DOWN
 *     by `heightM * PX_PER_METRE_HEIGHT` — a scale measured directly from a
 *     building (School of Engineering, ~55px of visible wall for an
 *     estimated ~15m height ⇒ ~3.67 px/m) — to approximate its base.
 *  3. The shifted (base) quad is run through the real homography solver, the
 *     same one `/editor` will use, so a bad site-corner estimate is easy to
 *     fix in one place later.
 */
import fs from "node:fs";
import path from "node:path";

import { applyH, solveHomography, type ControlPoint } from "../src/domain/geometry/homography";
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

const SITE_CORNERS_PX = {
  n: [430, 8] as Point,
  e: [1215, 388] as Point,
  s: [788, 545] as Point,
  w: [12, 250] as Point,
};

const MAP_LENGTH_M = 560;
const MAP_WIDTH_M = 420;

const controlPoints: ControlPoint[] = [
  { image: SITE_CORNERS_PX.n, map: [0, 0], label: "site-N" },
  { image: SITE_CORNERS_PX.e, map: [MAP_LENGTH_M, 0], label: "site-E" },
  { image: SITE_CORNERS_PX.s, map: [MAP_LENGTH_M, MAP_WIDTH_M], label: "site-S" },
  { image: SITE_CORNERS_PX.w, map: [0, MAP_WIDTH_M], label: "site-W" },
];

const H = solveHomography(controlPoints);
const toMap = (px: Point): Point => applyH(H, px);
const toMapRing = (ring: readonly Point[]): Point[] => ring.map(toMap);

/** Measured from School of Engineering's visible wall (~55px for ~15m). See file header. */
const PX_PER_METRE_HEIGHT = 3.67;

/** Shifts a traced ROOF point straight down to approximate its ground BASE. */
function roofToBase([x, y]: Point, heightM: number): Point {
  return [x, y + heightM * PX_PER_METRE_HEIGHT];
}

// ---------------------------------------------------------------------------
// 2. Buildings.
// ---------------------------------------------------------------------------

interface BuildingSpec {
  id: string;
  code?: string;
  mapNumber?: number;
  name: string;
  aliases: string[];
  category: BuildingCategory;
  heightM: number;
  /** Traced roof quad, N/E/S/W order (image px). For round buildings: a center + radius instead. */
  roofQuadPx?: [Point, Point, Point, Point];
  roofCirclePx?: { center: Point; radiusPx: number };
}

const BUILDING_SPECS: BuildingSpec[] = [
  {
    id: "bldg-h",
    code: "H",
    mapNumber: 2,
    name: "RAK Bank School of Business",
    aliases: ["business school", "school of business", "rak bank"],
    category: "academic",
    heightM: 14,
    // Algorithmically detected (connected-component corner extraction).
    roofQuadPx: [
      [902, 438],
      [1008, 478],
      [983, 496],
      [873, 447],
    ],
  },
  {
    id: "bldg-j",
    code: "J",
    mapNumber: 3,
    name: "Saqr Library",
    aliases: ["library", "main library", "saqr"],
    category: "academic",
    heightM: 14,
    roofQuadPx: [
      [789, 396],
      [862, 435],
      [836, 452],
      [740, 431],
    ],
  },
  {
    id: "bldg-k",
    code: "K",
    mapNumber: 4,
    name: "Abdullah Bin Ali Al Sharhan School of Arts and Sciences",
    aliases: ["arts and sciences", "school of arts and sciences", "al sharhan"],
    category: "academic",
    heightM: 14,
    roofQuadPx: [
      [1020, 350],
      [1100, 340],
      [1153, 377],
      [1073, 397],
    ],
  },
  {
    id: "bldg-g",
    code: "G",
    mapNumber: 5,
    name: "School of Engineering and Computing",
    aliases: ["engineering", "computing", "school of engineering"],
    category: "academic",
    heightM: 15,
    roofQuadPx: [
      [782, 273],
      [862, 302],
      [809, 341],
      [733, 309],
    ],
  },
  {
    id: "bldg-l",
    code: "L",
    mapNumber: 6,
    name: "Engineering Labs",
    aliases: ["labs", "engineering labs"],
    category: "academic",
    heightM: 9,
    // Read directly off a zoomed crop (automated detection couldn't separate
    // its roof tone from the adjacent parking lot).
    roofQuadPx: [
      [838, 263],
      [873, 250],
      [898, 270],
      [863, 283],
    ],
  },
  {
    id: "bldg-c",
    code: "C",
    mapNumber: 7,
    name: "Recreation Hub",
    aliases: ["recreation", "recreation hub"],
    category: "facilities",
    heightM: 7,
    roofQuadPx: [
      [500, 193],
      [722, 246],
      [700, 260],
      [478, 207],
    ],
  },
  {
    id: "bldg-d",
    code: "D",
    mapNumber: 8,
    name: "Admission and Registration",
    aliases: ["admission", "registration", "admissions"],
    category: "services",
    heightM: 9,
    roofCirclePx: { center: [536, 401], radiusPx: 37 },
  },
  {
    id: "bldg-a",
    code: "A",
    mapNumber: 9,
    name: "Student Life Hub",
    aliases: ["student life", "student life hub"],
    category: "services",
    heightM: 10,
    // NOT round (an earlier draft wrongly reused building 8's circle here) —
    // a square/diamond-roofed building, like 5 and 6 nearby.
    roofQuadPx: [
      [433, 265],
      [478, 300],
      [442, 328],
      [393, 296],
    ],
  },
  {
    id: "bldg-sports-hall",
    mapNumber: 10,
    name: "Sports Hall",
    aliases: ["sports hall", "gym"],
    category: "sports",
    heightM: 9,
    roofQuadPx: [
      [321, 132],
      [380, 155],
      [355, 174],
      [281, 135],
    ],
  },
  {
    id: "bldg-warehouse",
    mapNumber: 13,
    name: "Warehouse and Stores",
    aliases: ["warehouse", "stores"],
    category: "facilities",
    heightM: 6,
    roofQuadPx: [
      [283, 140],
      [309, 152],
      [283, 173],
      [258, 160],
    ],
  },
  {
    id: "bldg-mosque",
    mapNumber: 17,
    name: "AURAK Mosque",
    aliases: ["mosque", "masjid", "prayer room"],
    category: "landmark",
    heightM: 10,
    roofQuadPx: [
      [735, 470],
      [795, 478],
      [775, 515],
      [718, 505],
    ],
  },
  {
    id: "bldg-zeh",
    mapNumber: 18,
    name: "Zero Energy House (Solar Decathlon)",
    aliases: ["zero energy house", "solar decathlon"],
    category: "landmark",
    heightM: 6,
    roofQuadPx: [
      [945, 295],
      [963, 285],
      [975, 305],
      [958, 315],
    ],
  },
  {
    id: "bldg-temp",
    mapNumber: 19,
    name: "Temporary Buildings",
    aliases: ["temporary buildings"],
    category: "facilities",
    heightM: 6,
    // Large notched/U-shaped building, traced as its outer bounding quad.
    roofQuadPx: [
      [400, 145],
      [543, 145],
      [543, 225],
      [400, 225],
    ],
  },
  {
    id: "bldg-outdoor-comfort",
    mapNumber: 20,
    name: "RAK Center for Outdoor Comfort",
    aliases: ["outdoor comfort", "outdoor comfort center"],
    category: "landmark",
    heightM: 5,
    // Approximate: no distinctly separate structure was identifiable next to
    // Temporary Buildings (19) in the picture; placed adjacent to it.
    roofQuadPx: [
      [500, 205],
      [525, 205],
      [525, 225],
      [500, 225],
    ],
  },
  {
    id: "bldg-facilities-mgmt",
    mapNumber: 21,
    name: "Office of Facilities Management",
    aliases: ["facilities management"],
    category: "facilities",
    heightM: 6,
    roofQuadPx: [
      [270, 308],
      [292, 319],
      [270, 332],
      [248, 320],
    ],
  },
  {
    id: "bldg-admin",
    mapNumber: 22,
    name: "Admin Building",
    aliases: ["admin", "administration"],
    category: "facilities",
    heightM: 7,
    roofQuadPx: [
      [333, 335],
      [357, 348],
      [333, 361],
      [309, 348],
    ],
  },
];

const RESIDENCE_ROOFS_PX: [Point, Point, Point, Point][] = [
  [[913, 510], [945, 522], [897, 557], [866, 545]], // 1
  [[840, 483], [873, 495], [825, 530], [793, 518]], // 2
  [[686, 425], [732, 442], [684, 477], [653, 465]], // 3
  [[611, 398], [651, 404], [598, 445], [566, 432]], // 4
  [[465, 342], [497, 354], [450, 389], [418, 377]], // 5
  [[393, 316], [424, 327], [377, 362], [347, 350]], // 6
];
for (const [i, roofQuadPx] of RESIDENCE_ROOFS_PX.entries()) {
  const n = i + 1;
  BUILDING_SPECS.push({
    id: `bldg-res-${n}`,
    name: `Residential Hall ${n}`,
    aliases: [`residence ${n}`, `dorm ${n}`, "residential halls", "dorms", "student housing"],
    category: "residence",
    heightM: 16,
    roofQuadPx,
  });
}

// ---------------------------------------------------------------------------
// 3. Landscape / hardscape features.
// ---------------------------------------------------------------------------

const boundaryPx: Point[] = [
  SITE_CORNERS_PX.n,
  SITE_CORNERS_PX.e,
  SITE_CORNERS_PX.s,
  SITE_CORNERS_PX.w,
];

function insetQuad(ring: Point[], fraction: number): Point[] {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return ring.map(([x, y]): Point => [x + (cx - x) * fraction, y + (cy - y) * fraction]);
}

const roadOuterPx = boundaryPx;
const roadInnerPx = insetQuad(boundaryPx, 0.14);

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

// Parking lot (16), re-traced tightly against its visible edges.
const parkingPx: Point[] = [
  [710, 147],
  [1013, 157],
  [980, 297],
  [750, 260],
];

const lawnPx: Point[] = [
  [470, 265],
  [640, 235],
  [790, 330],
  [760, 420],
  [610, 400],
  [500, 340],
];

const pitchPx: Point[] = [
  [449, 59],
  [601, 116],
  [533, 165],
  [386, 104],
];

const courtsPx: Point[] = [
  [392, 118],
  [432, 133],
  [412, 168],
  [372, 153],
];

// Central plaza, re-traced against the visible paved/planted area around the pavilion.
const plazaPx: Point[] = [
  [850, 340],
  [1000, 355],
  [1003, 445],
  [853, 448],
];

const plazaPavilionCenterPx: Point = [973, 383];
const outdoorComfortCanopyPx: Point = [540, 200];

// Approximate: no distinct gate icon is legible in the picture; placed at the
// road opening nearest the south corner, closest to the boundary edge.
const gatePx: Point = [900, 565];

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

features.push({
  id: nextId("road"),
  layer: "road",
  geometry: {
    type: "Polygon",
    coordinates: [toMapRing(roadOuterPx), toMapRing(roadInnerPx)],
  },
});

// Dashed centreline down the middle of the road ring, one segment per side.
for (let i = 0; i < 4; i++) {
  const outerA = roadOuterPx[i]!;
  const outerB = roadOuterPx[(i + 1) % 4]!;
  const innerA = roadInnerPx[i]!;
  const innerB = roadInnerPx[(i + 1) % 4]!;
  const midA: Point = [(outerA[0] + innerA[0]) / 2, (outerA[1] + innerA[1]) / 2];
  const midB: Point = [(outerB[0] + innerB[0]) / 2, (outerB[1] + innerB[1]) / 2];
  features.push({
    id: nextId("roadmark"),
    layer: "road_marking",
    geometry: { type: "LineString", coordinates: [toMap(midA), toMap(midB)] },
  });
}

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

// Buildings: shift the traced roof geometry down to its base, THEN homograph it.
const buildings: Building[] = [];
for (const spec of BUILDING_SPECS) {
  let ring: Point[];
  if (spec.roofCirclePx) {
    const { center, radiusPx } = spec.roofCirclePx;
    const baseCenterPx = roofToBase(center, spec.heightM);
    ring = Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      const px: Point = [
        baseCenterPx[0] + Math.cos(a) * radiusPx,
        baseCenterPx[1] + Math.sin(a) * radiusPx,
      ];
      return toMap(px);
    });
  } else {
    const quad = spec.roofQuadPx!;
    ring = quad.map((p) => toMap(roofToBase(p, spec.heightM)));
  }

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

// Decorative trees (not traced precisely, see PLAN §4.4 item 9).
const treeSeedPx: Point[] = [
  [420, 60], [460, 70], [500, 85], [540, 95], [580, 108],
  [300, 130], [280, 145], [260, 165],
  [420, 260], [450, 275], [480, 290], [560, 300], [600, 310], [650, 320], [690, 335], [730, 350],
  [500, 350], [530, 365], [560, 380],
  [820, 380], [850, 395], [880, 405], [910, 385], [940, 370],
  [100, 300], [140, 320], [180, 340], [220, 360], [260, 300],
  [1000, 250], [1030, 270],
];
for (const px of treeSeedPx) {
  features.push({ id: nextId("tree"), layer: "tree", geometry: { type: "Point", coordinates: toMap(px) } });
}

const mapData: CampusMapData = {
  levelId: "ground",
  bounds: { width: MAP_LENGTH_M, height: MAP_WIDTH_M },
  features,
};

// ---------------------------------------------------------------------------
// 5. Places.
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

const levels = [
  { id: "ground", name: "Campus (outdoor)", kind: "site" as const, bounds: { width: MAP_LENGTH_M, height: MAP_WIDTH_M } },
];

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
