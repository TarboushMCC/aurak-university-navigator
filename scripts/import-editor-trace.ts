/**
 * Converts the user's hand-corrected trace (tools/aurak-trace.json, exported
 * from tools/campus-editor.html) into the final campus.json / map.json /
 * buildings.json / places.json under src/campus-data/aurak/.
 *
 *   npx tsx scripts/import-editor-trace.ts
 *
 * This replaces scripts/trace-aurak.ts as the authoring source now that the
 * user has manually placed every building and landscape shape on the leveled
 * satellite photo. Building metadata (name/code/category/height/aliases) is
 * still keyed by shape id, matching the ids trace-aurak.ts and
 * export-editor-shapes.ts originally seeded the editor with.
 *
 * Only shapes the user actually traced are rendered — no placeholder
 * decoration (tree dots, a "future expansion" zone) is carried over from the
 * earlier illustration-based draft, since those were never satellite-verified
 * and drifted outside the corrected boundary.
 */
import fs from "node:fs";
import path from "node:path";

import type { Point } from "../src/domain/geometry/vector";
import type {
  Building,
  BuildingCategory,
  CampusMapData,
  GraphEdge,
  GraphNode,
  MapFeature,
  NodeKind,
  Place,
  PlaceType,
} from "../src/domain/schema";

const OUT_DIR = path.resolve(import.meta.dirname, "../src/campus-data/aurak");
const TRACE_PATH = path.resolve(import.meta.dirname, "../tools/aurak-trace.json");

// ---------------------------------------------------------------------------
// 1. Geo scale: editor pixels -> metres. The editor's base image is now the
//    official architectural site plan (AURAK_Campus_Layout.pdf), which has
//    no GPS reference of its own — so instead of a lon/lat bbox, we
//    calibrate pixel scale by fitting the newly-traced boundary's pixel
//    bounding box to the campus's known real-world extent, established by
//    the earlier satellite-GPS trace this rebuild replaces (588m x 378m,
//    from src/campus-data/aurak/campus.json's last satellite-derived
//    bounds). The plan is drawn to scale, so this affine fit preserves
//    real-world accuracy without needing new GPS data.
// ---------------------------------------------------------------------------

const KNOWN_CAMPUS_SIZE_M = { width: 587.621800239944, height: 378.26858395060793 };

// ---------------------------------------------------------------------------
// 2. Read the user's trace and re-origin it to map metres.
// ---------------------------------------------------------------------------

interface TraceShape {
  id: string;
  label: string;
  points: Point[];
}
interface TraceNode {
  id: string;
  x: number;
  y: number;
  kind: NodeKind;
  label?: string;
}
interface TraceEdge {
  id: string;
  from: string;
  to: string;
}
const trace: {
  imageWidth: number;
  imageHeight: number;
  shapes: TraceShape[];
  nodes?: TraceNode[];
  edges?: TraceEdge[];
} = JSON.parse(fs.readFileSync(TRACE_PATH, "utf-8"));
let shapeById = new Map(trace.shapes.map((s) => [s.id, s]));

// If the user's trace dropped the campus-boundary shape (e.g. cleared and
// re-traced from scratch without re-adding it), fall back to the
// boundary this rebuild originally seeded the editor with — still needed
// both for scale calibration below and for the outer road ring the main
// loop draws from it.
if (!shapeById.has("feat-boundary")) {
  console.warn('No "feat-boundary" shape found in the trace — using the default campus boundary as a fallback.');
  trace.shapes.unshift({
    id: "feat-boundary",
    label: "Campus boundary",
    points: [
      [20, 300],
      [2760, 300],
      [2760, 2020],
      [20, 2020],
    ],
  });
  shapeById = new Map(trace.shapes.map((s) => [s.id, s]));
}

const boundaryShape = shapeById.get("feat-boundary")!;
const boundaryXs = boundaryShape.points.map((p) => p[0]);
const boundaryYs = boundaryShape.points.map((p) => p[1]);
const originX = Math.min(...boundaryXs);
const originY = Math.min(...boundaryYs);
const boundaryPxWidth = Math.max(...boundaryXs) - originX;
const boundaryPxHeight = Math.max(...boundaryYs) - originY;
const AVG_SCALE =
  (KNOWN_CAMPUS_SIZE_M.width / boundaryPxWidth + KNOWN_CAMPUS_SIZE_M.height / boundaryPxHeight) / 2;

const toMap = ([x, y]: Point): Point => [(x - originX) * AVG_SCALE, (y - originY) * AVG_SCALE];
const toMapRing = (ring: readonly Point[]): Point[] => ring.map(toMap);

// AURAK only has one officially-numbered gate (Gate 1, legend #1); every
// other opening in the boundary fence is a real, separately-walkable gate
// but has no official name to trace. Name it by where it sits on the
// boundary (thirds of the site's width/height) instead of leaving every one
// labeled the same generic "Gate" — that made them indistinguishable in
// search results.
const siteWidthM = boundaryPxWidth * AVG_SCALE;
const siteHeightM = boundaryPxHeight * AVG_SCALE;
const usedGateNames = new Map<string, number>();
function cardinalGateName(x: number, y: number): string {
  const fx = x / siteWidthM;
  const fy = y / siteHeightM;
  const ns = fy < 1 / 3 ? "North" : fy > 2 / 3 ? "South" : "";
  const ew = fx < 1 / 3 ? "West" : fx > 2 / 3 ? "East" : "";
  const base = `${ns}${ew}` ? `${ns}${ew} Gate` : "Central Gate";
  const seen = usedGateNames.get(base) ?? 0;
  usedGateNames.set(base, seen + 1);
  return seen === 0 ? base : `${base} (${seen + 1})`;
}
const centroidOf = (ring: readonly Point[]): Point => [
  ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ring.reduce((s, p) => s + p[1], 0) / ring.length,
];

function parseLabel(label: string): { mapNumber?: number; name: string } {
  const match = /^(\d+)\s*·\s*(.+)$/.exec(label);
  return match ? { mapNumber: Number(match[1]), name: match[2]! } : { name: label };
}

// ---------------------------------------------------------------------------
// 3. Building metadata, keyed by the shape id the user types into the
//    editor's shape-id field for each building they trace (see
//    tools/campus-editor.html's per-shape id input). Rewritten against the
//    official AURAK_Campus_Layout.pdf site plan — the source of truth this
//    rebuild replaces the old satellite hand-trace with. A handful of ids
//    (bldg-zeh, bldg-outdoor-comfort, bldg-warehouse, bldg-temp,
//    bldg-facilities-mgmt, bldg-admin) aren't on that plan but are kept here
//    because they're real buildings the user still wants traced in
//    alongside it, at their old approximate spots.
// ---------------------------------------------------------------------------

interface BuildingMeta {
  code?: string;
  mapNumber?: number;
  name: string;
  aliases: string[];
  category: BuildingCategory;
  heightM: number;
  /** Set false for staff-only buildings students can't route into (e.g. Warehouse, Temporary Buildings). */
  studentAccessible?: boolean;
}

// Map numbers 1-22 follow the original AURAK legend exactly (the 22-item
// numbered list the user's reference picture shows), not the order
// buildings happen to sit in on the official site plan. Names likewise
// default to that legend's wording, with the official plan's newer wording
// (e.g. "Student Affairs" for what the legend calls "Admission and
// Registration") kept only as an alias — the legend is authoritative here.
// A handful of buildings exist on the official plan but aren't part of that
// 22-item legend at all (Building B, Building E, Bolton University,
// Administration Building, Al Bait Al Kamel, the two Stores) — those are
// still real, still traced, still selectable, just left without a
// mapNumber since the legend has no slot for them.
const BUILDING_META: Record<string, BuildingMeta> = {
  "bldg-h": { code: "H", mapNumber: 2, name: "RAK Bank School of Business", aliases: ["business school", "school of business", "rak bank", "building h"], category: "academic", heightM: 14 },
  "bldg-j": { code: "J", mapNumber: 3, name: "Saqr Library", aliases: ["library", "main library", "saqr", "building j"], category: "academic", heightM: 14 },
  "bldg-k": { code: "K", mapNumber: 4, name: "Abdullah Bin Ali Al Sharhan School of Arts and Sciences", aliases: ["arts and sciences", "school of arts and sciences", "al sharhan", "building k", "abdullah ali alsharhan school of arts and science"], category: "academic", heightM: 14 },
  "bldg-g": { code: "G", mapNumber: 5, name: "School of Engineering and Computing", aliases: ["engineering", "school of engineering", "building g"], category: "academic", heightM: 15 },
  "bldg-l": { code: "L", mapNumber: 6, name: "Engineering Labs", aliases: ["labs", "engineering labs", "building l"], category: "academic", heightM: 9 },
  "bldg-c": { code: "C", mapNumber: 7, name: "Recreation Hub", aliases: ["student center", "cafeteria", "building c", "student center / cafeteria"], category: "services", heightM: 7 },
  "bldg-d": { code: "D", mapNumber: 8, name: "Admission and Registration", aliases: ["student affairs", "building d"], category: "services", heightM: 9 },
  "bldg-a": { code: "A", mapNumber: 9, name: "Student Life Hub", aliases: ["building a"], category: "facilities", heightM: 8 },
  "bldg-sports-complex": { mapNumber: 10, name: "Sports Hall", aliases: ["sports complex", "gym"], category: "sports", heightM: 9 },
  "bldg-warehouse": { mapNumber: 13, name: "Warehouse and Stores", aliases: ["warehouse", "stores", "storage"], category: "landmark", heightM: 6 },
  "bldg-res-1": { mapNumber: 15, name: "Student Residential Hall 1", aliases: ["residence 1", "dorm 1", "residential hall 1", "student housing"], category: "residence", heightM: 16 },
  "bldg-res-2": { mapNumber: 15, name: "Student Residential Hall 2", aliases: ["residence 2", "dorm 2", "residential hall 2", "student housing"], category: "residence", heightM: 16 },
  "bldg-res-3": { mapNumber: 15, name: "Student Residential Hall 3", aliases: ["residence 3", "dorm 3", "residential hall 3", "student housing"], category: "residence", heightM: 16 },
  "bldg-res-4": { mapNumber: 15, name: "Student Residential Hall 4", aliases: ["residence 4", "dorm 4", "residential hall 4", "student housing"], category: "residence", heightM: 16 },
  "bldg-res-5": { mapNumber: 15, name: "Student Residential Hall 5", aliases: ["residence 5", "dorm 5", "residential hall 5", "student housing"], category: "residence", heightM: 16 },
  "bldg-res-6": { mapNumber: 15, name: "Student Residential Hall 6", aliases: ["residence 6", "dorm 6", "residential hall 6", "student housing"], category: "residence", heightM: 16 },
  "bldg-mosque": { mapNumber: 17, name: "AURAK Mosque", aliases: ["mosque", "masjid", "prayer room"], category: "landmark", heightM: 10 },
  "bldg-zeh": { mapNumber: 18, name: "Zero Energy House (Solar Decathlon)", aliases: ["zero energy house", "solar decathlon"], category: "landmark", heightM: 6 },
  "bldg-temp": { mapNumber: 19, name: "Temporary Buildings", aliases: ["temporary buildings", "temp building"], category: "landmark", heightM: 6 },
  "bldg-outdoor-comfort": { mapNumber: 20, name: "RAK Center for Outdoor Comfort", aliases: ["outdoor comfort", "outdoor comfort center"], category: "landmark", heightM: 5 },
  "bldg-facilities-mgmt": { mapNumber: 21, name: "Office of Facilities Management", aliases: ["facilities management"], category: "facilities", heightM: 6 },
  "bldg-admin": { mapNumber: 22, name: "Admin Building", aliases: ["admin"], category: "facilities", heightM: 7 },
  // --- real buildings on the official plan, not part of the 22-item legend ---
  "bldg-b": { code: "B", name: "Building B", aliases: ["building b"], category: "facilities", heightM: 8 },
  "bldg-e": { code: "E", name: "Building E", aliases: ["building e"], category: "facilities", heightM: 8 },
  "bldg-f": { code: "F", name: "Bolton University", aliases: ["bolton", "bolton university", "building f"], category: "landmark", heightM: 10 },
  "bldg-i": { code: "I", name: "Administration Building", aliases: ["administration", "admin building", "building i"], category: "services", heightM: 9 },
  "bldg-albait": { name: "Al Bait Al Kamel", aliases: ["al bait al kamel"], category: "facilities", heightM: 6 },
  "bldg-store-1": { name: "Store", aliases: ["store"], category: "facilities", heightM: 4 },
  "bldg-store-2": { name: "Store", aliases: ["store"], category: "facilities", heightM: 4 },
};

/** The non-building legend numbers, same source (the reference picture) as BUILDING_META's. */
const LEGEND_NUMBERS = {
  mainGate: 1,
  sportsFields: 11,
  footballField: 12,
  greenLawn: 14,
  studentParking: 16,
};

// ---------------------------------------------------------------------------
// 4. Walk the trace and build features / buildings / places.
// ---------------------------------------------------------------------------

const features: MapFeature[] = [];
const buildings: Building[] = [];
const places: Place[] = [];
/**
 * Geometry of every routable place, for linking entrance/door nodes to the
 * nearest one: a single point (its centroid) for buildings/gate, or the full
 * ring for large landscape polygons (fields/courts/lawn/parking) — an
 * entrance can sit near a field's edge while being far from its centroid.
 */
// A place can be traced as more than one shape on the new plan (two tennis
// courts both feeding "place.sports-fields", several lots feeding
// "place.parking") — so each place holds an array of rings, not just one.
const placeAnchorGeom = new Map<string, Point[][]>();
function addAnchorGeom(placeId: string, ring: Point[]) {
  const existing = placeAnchorGeom.get(placeId);
  if (existing) existing.push(ring);
  else placeAnchorGeom.set(placeId, [ring]);
}
function upsertPlace(place: Place) {
  if (places.some((p) => p.id === place.id)) return;
  places.push(place);
}
function pointToPolylineDist(p: Point, ring: Point[]): number {
  if (ring.length === 1) return Math.hypot(p[0] - ring[0]![0], p[1] - ring[0]![1]);
  let min = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const abx = b[0] - a[0], aby = b[1] - a[1];
    const lenSq = abx * abx + aby * aby || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / lenSq));
    const projX = a[0] + t * abx, projY = a[1] + t * aby;
    min = Math.min(min, Math.hypot(p[0] - projX, p[1] - projY));
  }
  return min;
}
function pointToGeomDist(p: Point, rings: Point[][]): number {
  return Math.min(...rings.map((ring) => pointToPolylineDist(p, ring)));
}
let featureCounter = 0;
const nextId = (prefix: string) => `${prefix}-${(featureCounter++).toString(36)}`;
/** The traced Main Gate shape's centroid, used below to find its own gate-kind node among possibly several. */
let mainGateCentroid: Point | undefined;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The editor doesn't force the user to type a shape's id as "bldg-h" —
 * most just type a plain descriptive label ("School Of Business"). So a
 * building shape is matched two ways: first by id (still the most precise
 * path, e.g. "bldg-h"), then by fuzzy-matching the label text against every
 * BUILDING_META entry's name/aliases. Exact match wins; substring match is
 * the fallback (covers old naming this rebuild replaced, e.g. "Recreation
 * Hub" for what's now "Student Center / Cafeteria").
 */
function matchBuildingMeta(shape: TraceShape): { key: string; meta: BuildingMeta } | undefined {
  if (BUILDING_META[shape.id]) return { key: shape.id, meta: BUILDING_META[shape.id]! };
  const label = normalize(shape.label);
  if (!label) return undefined;
  let substringHit: { key: string; meta: BuildingMeta } | undefined;
  for (const [key, meta] of Object.entries(BUILDING_META)) {
    const candidates = [meta.name, ...meta.aliases].map(normalize);
    if (candidates.includes(label)) return { key, meta };
    if (!substringHit && candidates.some((c) => c.includes(label) || label.includes(c))) {
      substringHit = { key, meta };
    }
  }
  return substringHit;
}

/**
 * Shapes the user traced that are real, physically-present features (a
 * utility room, a water fountain, a decorative roundabout) but were never
 * meant to be pickable as a start/destination. Rendered as an inert "plaza"
 * footprint — visible on the map, no click handler, not in search.
 */
const NON_DESTINATION_RE =
  /electricity room|water fountain|\bfountain\b|pump room|substation|fire.{0,15}pump|chiller|roundabout/i;

for (const shape of trace.shapes) {
  const buildingMatch = shape.id.startsWith("bldg-") || !NON_DESTINATION_RE.test(shape.label)
    ? matchBuildingMeta(shape)
    : undefined;
  if (buildingMatch) {
    const { key, meta } = buildingMatch;
    const ring = toMapRing(shape.points);
    const centroid = centroidOf(ring);
    features.push({ id: `feat-${key}`, layer: "building", geometry: { type: "Polygon", coordinates: [ring] }, buildingId: key, heightM: meta.heightM });
    buildings.push({ id: key, code: meta.code, mapNumber: meta.mapNumber, name: meta.name, aliases: meta.aliases, floors: [0], category: meta.category, heightM: meta.heightM, labelAt: centroid });

    const placeType: PlaceType =
      meta.category === "residence" ? "residence"
      : meta.category === "sports" ? "sports"
      : meta.category === "services" ? "service"
      : meta.category === "landmark" ? "landmark"
      : "building";
    const placeId = `place.${key.replace(/^bldg-/, "")}`;
    places.push({ id: placeId, type: placeType, name: meta.name, buildingId: key, aliases: meta.aliases, anchors: [], startable: meta.studentAccessible !== false, mapNumber: meta.mapNumber });
    // The building's full footprint ring, not just its centroid — a door
    // sitting near the wall of a large building is often nearer to an
    // adjacent landscape feature's centroid than to this building's own
    // centre, which was wrongly poaching entrance nodes that belonged to
    // the building next door (e.g. Recreation Hub's own door being claimed
    // by the neighbouring Green Lawn instead, leaving the building to fall
    // back to whatever node was left over). Comparing against the ring
    // means "nearest point on the wall" competes fairly with "nearest point
    // on the lawn's edge" instead of "nearest point on the lawn" vs.
    // "distance to a point deep inside the building."
    if (meta.studentAccessible !== false) addAnchorGeom(placeId, ring);
    continue;
  }

  if (!shape.id.startsWith("bldg-") && NON_DESTINATION_RE.test(shape.label)) {
    const ring = toMapRing(shape.points);
    features.push({ id: nextId("plaza"), layer: "plaza", geometry: { type: "Polygon", coordinates: [ring] } });
    continue;
  }

  const { mapNumber, name } = parseLabel(shape.label);

  if (shape.id === "feat-boundary") {
    const ring = toMapRing(shape.points);
    features.push({ id: nextId("boundary"), layer: "boundary", geometry: { type: "Polygon", coordinates: [ring] } });

    const insetQuad = (r: Point[], fraction: number): Point[] => {
      const c = centroidOf(r);
      return r.map(([x, y]): Point => [x + (c[0] - x) * fraction, y + (c[1] - y) * fraction]);
    };
    const roadInner = insetQuad(ring, 0.09);
    features.push({ id: nextId("road"), layer: "road", geometry: { type: "Polygon", coordinates: [ring, roadInner] } });
    for (let i = 0; i < ring.length; i++) {
      const outerA = ring[i]!;
      const outerB = ring[(i + 1) % ring.length]!;
      const innerA = roadInner[i]!;
      const innerB = roadInner[(i + 1) % ring.length]!;
      const midA: Point = [(outerA[0] + innerA[0]) / 2, (outerA[1] + innerA[1]) / 2];
      const midB: Point = [(outerB[0] + innerB[0]) / 2, (outerB[1] + innerB[1]) / 2];
      features.push({ id: nextId("roadmark"), layer: "road_marking", geometry: { type: "LineString", coordinates: [midA, midB] } });
    }
    continue;
  }

  if (shape.id === "feat-track" || /football/i.test(name)) {
    const num = LEGEND_NUMBERS.footballField;
    features.push({ id: nextId("field"), layer: "field", geometry: { type: "Polygon", coordinates: [toMapRing(shape.points)] }, variant: "football", label: "Football Field", mapNumber: num, placeId: "place.football-field" });
    upsertPlace({ id: "place.football-field", type: "sports", name: "Football Field", aliases: ["football field", "pitch", "stadium"], anchors: [], startable: true, mapNumber: num });
    addAnchorGeom("place.football-field", toMapRing(shape.points));
    continue;
  }

  if (/sports field|tennis/i.test(name)) {
    const num = LEGEND_NUMBERS.sportsFields;
    features.push({ id: nextId("court"), layer: "court", geometry: { type: "Polygon", coordinates: [toMapRing(shape.points)] }, variant: "courts", label: "Sports Fields", mapNumber: num, placeId: "place.sports-fields" });
    upsertPlace({ id: "place.sports-fields", type: "sports", name: "Sports Fields", aliases: ["sports fields", "courts", "tennis courts", "tennis"], anchors: [], startable: true, mapNumber: num });
    addAnchorGeom("place.sports-fields", toMapRing(shape.points));
    continue;
  }

  if (/parking/i.test(name)) {
    const num = LEGEND_NUMBERS.studentParking;
    features.push({ id: nextId("parking"), layer: "parking", geometry: { type: "Polygon", coordinates: [toMapRing(shape.points)] }, label: "Student Parking", mapNumber: num, placeId: "place.parking" });
    upsertPlace({ id: "place.parking", type: "parking", name: "Student Parking", aliases: ["parking", "car park", "student parking"], anchors: [], startable: true, mapNumber: num });
    addAnchorGeom("place.parking", toMapRing(shape.points));
    continue;
  }

  if (shape.id === "feat-lawn" || /lawn/i.test(name)) {
    const num = LEGEND_NUMBERS.greenLawn;
    features.push({ id: nextId("lawn"), layer: "lawn", geometry: { type: "Polygon", coordinates: [toMapRing(shape.points)] }, label: "Green Lawn", mapNumber: num, placeId: "place.green-lawn" });
    upsertPlace({ id: "place.green-lawn", type: "landmark", name: "Green Lawn", aliases: ["lawn", "the lawn", "central lawn"], anchors: [], startable: true, mapNumber: num });
    addAnchorGeom("place.green-lawn", toMapRing(shape.points));
    continue;
  }

  if (/bus/i.test(name)) {
    // A dedicated "poi" node the user traced for the bus stop itself is a
    // much more precise icon anchor than the shape's polygon centroid (the
    // paved area and the actual stop rarely share a center) — prefer it
    // when present, and keep the polygon purely decorative (no label/
    // placeId of its own) so it doesn't also compete for the marker.
    const poiNode = (trace.nodes ?? []).find((n) => n.kind === "poi" && /bus/i.test(n.label ?? ""));
    if (poiNode) {
      features.push({ id: nextId("plaza"), layer: "plaza", geometry: { type: "Polygon", coordinates: [toMapRing(shape.points)] } });
      features.push({ id: nextId("plaza"), layer: "plaza", geometry: { type: "Point", coordinates: toMap([poiNode.x, poiNode.y]) }, label: "Bus Area", placeId: "place.bus-area" });
    } else {
      features.push({ id: nextId("plaza"), layer: "plaza", geometry: { type: "Polygon", coordinates: [toMapRing(shape.points)] }, label: "Bus Area", placeId: "place.bus-area" });
    }
    upsertPlace({ id: "place.bus-area", type: "service", name: "Bus Area", aliases: ["bus area", "bus stop", "shuttle", "bus"], anchors: [], startable: true });
    addAnchorGeom("place.bus-area", toMapRing(shape.points));
    continue;
  }

  if (/gate/i.test(name)) {
    const centroid = centroidOf(toMapRing(shape.points));
    features.push({ id: nextId("gate"), layer: "gate", geometry: { type: "Point", coordinates: centroid }, label: "AURAK Main Gate", mapNumber: LEGEND_NUMBERS.mainGate, placeId: "place.gate1" });
    upsertPlace({ id: "place.gate1", type: "gate", name: "AURAK Main Gate", aliases: ["gate 1", "main gate", "entrance"], anchors: [], startable: true, mapNumber: LEGEND_NUMBERS.mainGate });
    mainGateCentroid = centroid;
    continue;
  }

  // A shape that doesn't match any known building name or landscape keyword
  // still got traced for a reason — dropping it entirely made it silently
  // vanish from the map instead of just not being a selectable destination.
  // Render it as an inert decorative footprint (same treatment as the
  // explicit NON_DESTINATION_RE matches above) rather than losing it.
  if (name.trim()) {
    const ring = toMapRing(shape.points);
    features.push({ id: nextId("plaza"), layer: "plaza", geometry: { type: "Polygon", coordinates: [ring] } });
    console.warn(`Shape "${shape.id}" ("${shape.label}") didn't match a known building or category — drawn as a plain decorative shape, not a selectable destination.`);
  } else {
    console.warn(`Shape "${shape.id}" has no label — skipped entirely.`);
  }
}

// ---------------------------------------------------------------------------
// 5. Walkway graph: the user's hand-traced nodes/edges, converted to metres
//    and linked to the places they sit next to (so routing knows which node
//    to route to/from for a given building, gate, or parking lot).
// ---------------------------------------------------------------------------

const graphNodes: GraphNode[] = (trace.nodes ?? []).map((n) => {
  const [x, y] = toMap([n.x, n.y]);
  return { id: n.id, kind: n.kind, levelId: "ground", x, y, floor: 0, indoor: false, name: n.label || undefined };
});
const graphEdges: GraphEdge[] = (trace.edges ?? []).flatMap((e) => {
  const from = graphNodes.find((n) => n.id === e.from);
  const to = graphNodes.find((n) => n.id === e.to);
  if (!from || !to) {
    console.warn(`Edge "${e.id}" references a missing node — skipped`);
    return [];
  }
  const lengthM = Math.hypot(from.x - to.x, from.y - to.y);
  return [{ id: e.id, from: e.from, to: e.to, bidirectional: true, kind: "walkway" as const, lengthM, accessible: null }];
});

// Every gate-kind node is its own selectable place — a campus can have more
// than one real gate (the traced Main Gate, a separate Parking Gate, etc.),
// and each should be individually pickable as a start/destination, not
// merged together. The node closest to the traced Main Gate shape becomes
// that shape's anchor; every other gate-kind node gets a brand new Place +
// map marker of its own.
const gateNodes = graphNodes.filter((n) => n.kind === "gate");
let mainGateNodeId: string | undefined;
if (mainGateCentroid && gateNodes.length > 0) {
  let closest = gateNodes[0]!;
  let closestDist = Math.hypot(closest.x - mainGateCentroid[0], closest.y - mainGateCentroid[1]);
  for (const n of gateNodes.slice(1)) {
    const dist = Math.hypot(n.x - mainGateCentroid[0], n.y - mainGateCentroid[1]);
    if (dist < closestDist) { closest = n; closestDist = dist; }
  }
  mainGateNodeId = closest.id;
  places.find((p) => p.id === "place.gate1")?.anchors.push(closest.id);
}
for (const node of gateNodes) {
  if (node.id === mainGateNodeId) continue;
  const placeId = `place.gate.${node.id}`;
  const name = node.name || cardinalGateName(node.x, node.y);
  features.push({ id: nextId("gate"), layer: "gate", geometry: { type: "Point", coordinates: [node.x, node.y] }, label: name, placeId });
  places.push({ id: placeId, type: "gate", name, aliases: [name.toLowerCase()], anchors: [node.id], startable: true });
}

// Link each entrance/door/parking/poi/landmark node to the nearest matching
// place as a routing anchor (Place.anchors), by proximity in map metres.
// Every eligible kind goes through the SAME nearest-place search — no kind
// is ever blanket-assigned to one hardcoded place — so two nodes of the
// same kind don't get silently merged into one place's anchor pool, where
// routing would treat them as interchangeable and pick whichever is
// cheapest instead of the one the user actually selected.
const ANCHOR_ELIGIBLE_KINDS = new Set(["entrance", "door", "poi", "landmark", "parking"]);
const ANCHOR_MAX_DIST_M = 70;
for (const node of graphNodes) {
  if (!ANCHOR_ELIGIBLE_KINDS.has(node.kind)) continue;
  let best: { placeId: string; dist: number } | undefined;
  for (const [placeId, geom] of placeAnchorGeom) {
    const dist = pointToGeomDist([node.x, node.y], geom);
    if (!best || dist < best.dist) best = { placeId, dist };
  }
  if (best && best.dist <= ANCHOR_MAX_DIST_M) {
    const place = places.find((p) => p.id === best!.placeId);
    place?.anchors.push(node.id);
    if (place?.buildingId) node.buildingId = place.buildingId;
  }

  // A node the user explicitly labelled as shared between two residence
  // halls (e.g. "Residential Hall 6 and 5 entrance") is a real single
  // doorway serving both buildings, not a proximity tie to resolve toward
  // one — nearest-place-wins would otherwise silently drop it from
  // whichever hall it's slightly farther from.
  if (node.name) {
    for (const m of node.name.matchAll(/hall\s*(\d+)/gi)) {
      const placeId = `place.res-${m[1]}`;
      const place = places.find((p) => p.id === placeId);
      if (place && !place.anchors.includes(node.id)) place.anchors.push(node.id);
    }
  }
}

// Any startable place nobody traced a dedicated entrance/door for (e.g. a
// staff-only building that's still worth showing as a destination) falls
// back to whichever walkway node is nearest its own landmark point — it
// still needs a real connection into the network to be routable at all.
for (const place of places) {
  if (!place.startable || place.anchors.length > 0) continue;
  const geom = placeAnchorGeom.get(place.id);
  if (!geom) continue;
  let best: { node: GraphNode; dist: number } | undefined;
  for (const node of graphNodes) {
    const dist = pointToGeomDist([node.x, node.y], geom);
    if (!best || dist < best.dist) best = { node, dist };
  }
  if (best) place.anchors.push(best.node.id);
}

// Connectivity check: every place with an anchor should be reachable from
// every other one, or routing between them will silently fail later.
{
  const adjacency = new Map<string, string[]>();
  for (const n of graphNodes) adjacency.set(n.id, []);
  for (const e of graphEdges) {
    adjacency.get(e.from)?.push(e.to);
    adjacency.get(e.to)?.push(e.from);
  }
  const seen = new Set<string>();
  if (graphNodes[0]) {
    const queue = [graphNodes[0].id];
    seen.add(graphNodes[0].id);
    while (queue.length) {
      const id = queue.shift()!;
      for (const next of adjacency.get(id) ?? []) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
  }
  const unreached = graphNodes.filter((n) => !seen.has(n.id));
  if (unreached.length) {
    console.warn(
      `${unreached.length} walkway node(s) aren't connected to the main network: ${unreached.map((n) => n.label || n.kind).join(", ")}`,
    );
  }
  const placesWithoutAnchor = places.filter((p) => p.startable && p.anchors.length === 0);
  if (placesWithoutAnchor.length) {
    console.warn(`${placesWithoutAnchor.length} place(s) have no walkway anchor yet: ${placesWithoutAnchor.map((p) => p.name).join(", ")}`);
  }
}

// ---------------------------------------------------------------------------
// 6. Bounds and write.
// ---------------------------------------------------------------------------

const allPoints = features.flatMap((f) => {
  if (f.geometry.type === "Polygon") return f.geometry.coordinates.flat();
  if (f.geometry.type === "LineString") return f.geometry.coordinates;
  return [f.geometry.coordinates];
});
const maxX = Math.max(...allPoints.map((p) => p[0]));
const maxY = Math.max(...allPoints.map((p) => p[1]));
const PAD_M = 15;
const mapWidth = maxX + PAD_M;
const mapHeight = maxY + PAD_M;

const mapData: CampusMapData = { levelId: "ground", bounds: { width: mapWidth, height: mapHeight }, features };

const campus = {
  id: "aurak",
  name: "American University of Ras Al Khaimah",
  shortName: "AURAK",
  defaultLevelId: "ground",
  walkingSpeedMps: { default: 1.3, accessible: 1.0 },
};
const levels = [{ id: "ground", name: "Campus (outdoor)", kind: "site" as const, bounds: { width: mapWidth, height: mapHeight } }];

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "campus.json"), JSON.stringify({ campus, levels }, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "map.json"), JSON.stringify(mapData, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "buildings.json"), JSON.stringify(buildings, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "places.json"), JSON.stringify(places, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "nodes.json"), JSON.stringify(graphNodes, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "edges.json"), JSON.stringify(graphEdges, null, 2));

console.log(`Wrote ${buildings.length} buildings, ${features.length} map features, ${places.length} places to ${OUT_DIR}`);
console.log(`Wrote ${graphNodes.length} walkway nodes, ${graphEdges.length} walkway edges`);
console.log(`Campus bbox: ${mapWidth.toFixed(0)}m x ${mapHeight.toFixed(0)}m`);
