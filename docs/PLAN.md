# University Navigator: Architecture & Build Plan

> Campus: **American University of Ras Al Khaimah (AURAK)**
> Map: **real vector map generated from data** (`src/campus-data/aurak/map.json`). Tracing reference only: `src/campus-data/aurak/reference/campus-reference.jpg` (1360 × 802 px perspective render, unchanged copy from `Desktop\campus directory`, never shown to users)
> Status: plan approved for implementation. Build **phase by phase**, and stop at each phase's acceptance criteria.

## ⭐ v1 scope decisions (from the user; these override anything below)

1. **Building-to-building navigation only.** Starts and destinations are the 22 legend entries (buildings, gate, parking, mosque, fields, lawn, residences). **No rooms, floors, or indoor routing in v1.** The schema stays room-ready (§3.5). The room directory is a **future feature**.
2. **The app renders a real vector map generated from data, not the picture.** The AURAK picture is a **tracing reference only**. It appears in the dev editor as an underlay and is **never shown to users**. The map users see is a top-down 2D SVG drawn from `map.json`: site boundary, roads, parking with bays, lawns, sports fields with markings, plazas, walkways, building footprints with soft 2.5D shadows, trees, number badges, names, and icons. It is crisp at any zoom, has light and dark themes, can rotate, and every feature is interactive.
3. **No AI image generation for the map.** AI images invent paths and buildings. Every shape is **traced from the real picture**, so the map matches the campus.
4. **Exact shortest distance is not a goal.** Routes must be sensible and follow real walkways. Distances and times are approximate ("about 3 min walk"). Scale comes from the football field (standard pitch ≈ 105 × 68 m), so no measuring is needed.
5. **The user reviews the map and the pathways.** Claude traces a draft, sends screenshots (the rendered map side-by-side with the picture), and the user corrects in plain words (§4.6).
6. **Top priority: interactive and visual.** Clickable, hoverable buildings. Tap two buildings to get a route. An animated route with a walker dot. The camera flies to each step. **Heading-up map rotation** in Guide View. Large animated arrows. Polish goes here first.
7. The picture is final (no better version). That's fine, because it's only used for tracing.

---

## 0. From the reference picture to a real map (read this first)

The picture: `src/campus-data/aurak/reference/campus-reference.jpg` (1360 × 802, perspective 3D render, WhatsApp-compressed). What it means for tracing:

| Observation | Consequence |
|---|---|
| It is a **perspective 3D view of a flat site** | The ground plane maps exactly to a top-down plan with a **4-point homography** (projective transform). An affine transform isn't enough: the site's short edges are visibly not parallel in the picture (NW fence slope ≈ −0.6, SE fence ≈ −0.8). See §4.2. |
| Buildings have **height**, and roofs are displaced up and away from their ground position | Trace footprints at the **base**, where the walls meet the ground, not the roof outline. In the warped top-down reference, tall buildings visibly "lean". Use the ground-contact edges. |
| The site is roughly a **rectangle**, and most buildings are rectangles aligned to it | The canonical map frame is **axis-aligned to the site**. Most footprints then become simple rectangles, and the editor's rectangle tool traces them in seconds. |
| Low-res JPEG with a viewer "i" button baked in | It doesn't matter: users never see it. |
| The legend is baked into the image | It becomes **data** (numbers, names, codes) rendered as real labels and search entries. |
| The football field (12) is a standard pitch | It gives the **scale**: make the traced pitch ≈ 105 m long. Its 105:68 ratio also checks that the homography is right. |

### Legend → data seed (verified by zooming into the picture)

The positions below are **reference-picture pixel** coordinates of each roof label, for orientation only. Real geometry is traced in map metres.

| # | Name | Code | Picture label ≈ (x, y) px | Type |
|---|---|---|---|---|
| 1 | AURAK Main Gate (Gate No. 1) | GATE1 | (1105, 478) | gate |
| 2 | RAK Bank School of Business | H | (960, 470) | academic |
| 3 | Saqr Library | J | (830, 436) | library |
| 4 | Abdullah Bin Ali Al Sharhan School of Arts and Sciences | K | (1095, 382) | academic |
| 5 | School of Engineering and Computing | G | (805, 325) | academic |
| 6 | Engineering Labs | L | (885, 290) | labs |
| 7 | Recreation Hub | C | (588, 232) (long building by the lawn) | recreation |
| 8 | Admission and Registration | D | (535, 410) (round building) | services |
| 9 | Student Life Hub | A | (445, 318) | student services |
| 10 | Sports Hall | — | (338, 158) | sports |
| 11 | Sports Fields | — | (368, 133) | sports |
| 12 | Football Field | — | (535, 113) | sports |
| 13 | Warehouse and Stores | — | (283, 183) | facilities |
| 14 | Green Lawn | — | (630, 280) | landmark |
| 15 | Student Residential Halls 1–6 | RES1–RES6 | 1 (905,550) · 2 (833,525) · 3 (695,470) · 4 (607,437) · 5 (460,380) · 6 (380,358) | residence |
| 16 | Student Parking | — | (715, 207) | parking |
| 17 | AURAK Mosque | — | (757, 488) (building with minaret) | mosque |
| 18 | Zero Energy House (Solar Decathlon) | — | (952, 310) | landmark |
| 19 | Temporary Buildings | — | (490, 210) | misc |
| 20 | RAK Center for Outdoor Comfort | — | (540, 203) | research |
| 21 | Office of Facilities Management | — | (278, 318) | facilities |
| 22 | Admin Building | — | (322, 350) | admin |
| — | Central plaza / pavilion (round canopy) | — | (970, 385) | landmark |

---

## 1. Technical architecture

The core idea: **the first version is a static client-side app, and routing always runs in the browser.** When a backend arrives, it acts as a **campus-data CMS** (edit → validate → publish a versioned JSON snapshot). It is not a routing server. Clients keep downloading one JSON document and running A* locally. This makes the app fast and offline-capable, and adding the backend never changes how navigation works.

```
┌─────────────────────────── Browser (React SPA) ───────────────────────────┐
│                                                                           │
│  UI features          Home · Navigate (Map View / Guide View) · Place     │
│  (React)              Details · Editor (dev-only → future Admin)          │
│        │                                                                  │
│        ▼                                                                  │
│  domain/  (pure TypeScript, zero React, 100% unit-tested)                 │
│   ├─ geometry   vectors, angles, polygons, homography (editor only)       │
│   ├─ graph      build adjacency, A*, cost functions, route profiles       │
│   ├─ routing    planRoute(from, to, profile) → Route                      │
│   ├─ instructions  Route → Step[] (turns, stairs, landmarks, arrival)     │
│   ├─ search     fuzzy index + room-code parser                            │
│   └─ validate   graph integrity checks                                    │
│        ▲                                                                  │
│        │  CampusBundle (validated with zod)                               │
│  data/CampusRepository  (interface)                                       │
│   ├─ StaticJsonRepository   ← v1: imports /src/campus-data/aurak/*.json   │
│   └─ ApiRepository          ← v4: GET /api/campuses/:id/published         │
└───────────────────────────────────────────────────────────────────────────┘
                                   ▲ (Phase 4 only)
┌──────────────── Node API (Fastify/Express) + PostgreSQL ──────────────────┐
│  Admin CRUD on draft tables → validate → publish immutable JSON snapshot  │
│  Anonymous analytics: route_requested(from, to, profile), no PII          │
└───────────────────────────────────────────────────────────────────────────┘
```

Principles:
1. **Domain logic is framework-free.** A*, instruction generation, and search live in `src/domain` as pure functions with tests. React only renders their output.
2. **The URL is the navigation state.** `/navigate?from=gate1&to=place.library&mode=accessible&view=guide&step=3`. This gives shareable links, a working Back button, deep links, and QR codes (see §8.6).
3. **Data-driven, multi-campus from day one.** Every file lives under `campus-data/<campusId>/`. Nothing in code mentions AURAK.
4. **Places ≠ Nodes.** People search for *places* (a library, a room, a department). The router works on *nodes* (doors, junctions, stairs). A place points to one or more anchor nodes. This separation is the most important improvement over the draft structure in the brief (§3.3).

---

## 2. Recommended technology stack

| Concern | Choice | Why |
|---|---|---|
| Build / dev | **Vite 7 + React 19 + TypeScript (strict)** | Pure client app. No SSR needed. Static hosting (GitHub Pages / Netlify / Vercel). |
| Routing | **React Router 7** (library mode) | `useSearchParams` makes the URL the state. |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) + CSS variables for tokens | Fast, consistent, easy responsive design. |
| Animation | **Motion** (`motion/react`) | Spring arrow rotation, step transitions, `AnimatePresence`, respects reduced-motion. |
| Map rendering | **Hand-rolled React SVG** from `map.json` (a few hundred features) | Full control of styling, animation, and interaction. No tile/GIS engine needed for one campus in planar metres. |
| Map camera | **Custom `useMapCamera`** (Motion springs) + **@use-gesture/react** | Pan, pinch, wheel, **rotate** (heading-up), `fitBounds`/`flyTo` with smooth animation. |
| Search | **Fuse.js 7** + custom room-code parser | Forgiving partial and typo matching. Exact codes ("C204", "H") ranked first. |
| Validation | **zod 4** | Validates JSON now and API responses later with the same schema. Types come from `z.infer`. |
| Icons | **lucide-react** | Stairs, elevator, and accessibility icons available. |
| Tests | **Vitest** (+ Testing Library for key components) | A*, turn classification, and instruction snapshots. |
| State | URL params + `useState`; `localStorage` for recent locations | No Zustand/Redux needed in v1. |
| Backend (Phase 4) | **Fastify or Express + PostgreSQL + Drizzle ORM**, admin auth via session cookie | Only when an admin panel is needed. PostGIS is **not** needed (coordinates are planar metres, not lat/lng). |

Avoid in v1: Next.js (no benefit for a map SPA), Leaflet/MapLibre (geographic tile engines, overkill for one planar campus map), a routing server, and GPS/geolocation APIs.

---

## 3. Data model

### 3.1 Coordinate systems

- **Map metres (canonical, stored everywhere):** a top-down planar frame. Origin is the top-left corner of the site boundary. **x runs along the long axis of the site, y along the short axis, and y points down** (SVG convention). With this handedness, a positive cross product = a **right turn**. All `map.json` geometry, graph nodes, and edge `via` points use metres. Distances and angles are computed directly, with no runtime transform.
- **Reference picture pixels (editor only):** used only in `reference.json` control points. The homography `H` (picture → metres) is solved in the editor to warp the underlay. Nothing at runtime depends on it.
- The format is **GeoJSON-compatible in planar coordinates**. If the map ever needs real lat/lng (e.g. export to other tools), a single georeference transform converts everything.

### 3.2 TypeScript types (source of truth = zod schemas in `domain/schema.ts`)

```ts
// ---------- Campus bundle (one JSON document per published version) ----------
export interface CampusBundle {
  schemaVersion: 1;
  campus: Campus;
  levels: MapLevel[];     // one per drawable map (outdoor ground, later: floor plans)
  buildings: Building[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  places: Place[];
}

export interface Campus {
  id: string;                     // "aurak"
  name: string;                   // "American University of Ras Al Khaimah"
  shortName: string;              // "AURAK"
  defaultLevelId: string;         // "ground"
  walkingSpeedMps: { default: number; accessible: number }; // 1.3 / 1.0
}

export interface MapLevel {
  id: string;                     // "ground" | "bldg-g-f2" (future floor plan)
  name: string;                   // "Campus (outdoor)"
  kind: "site" | "floorplan";
  buildingId?: string;            // for floorplans
  floor?: number;                 // for floorplans
  bounds: { width: number; height: number };                            // metres
  defaultView?: { x: number; y: number; width: number; height: number }; // camera frame, metres
  northDeg?: number;              // optional: rotation of true north for a compass chip
  // geometry lives in map.json (§4.3); the reference picture lives in reference/reference.json (editor only)
}

export interface Building {
  id: string;                     // "bldg-j"
  code?: string;                  // "J"  (AURAK letter code)
  mapNumber?: number;             // 3    (legend number)
  name: string;                   // "Saqr Library"
  aliases: string[];              // ["library", "main library", "saqr"]
  floors: number[];               // [0, 1, 2]  (0 = ground)
  category: "academic" | "services" | "residence" | "sports" | "facilities" | "landmark";
  heightM?: number;               // for shadows / optional 3D view
  labelAt?: [number, number];     // metres; default = footprint centroid (footprint = map.json feature with this buildingId)
  labelPriority?: number;         // higher = keeps its label at low zoom
}

export type NodeKind =
  | "gate" | "entrance" | "junction" | "door"
  | "stairs" | "elevator" | "ramp"
  | "room" | "poi" | "landmark" | "parking";

export interface GraphNode {
  id: string;                     // "j.entrance.main", "junction.plaza", "g.f2.stairs.east"
  kind: NodeKind;
  levelId: string;                // which map it's drawn on ("ground" for all indoor nodes until floor plans exist)
  x: number; y: number;           // metres (map frame)
  floor: number;                  // 0 outdoor/ground
  buildingId?: string;
  name?: string;                  // only for nodes worth mentioning in instructions ("Central Plaza")
  landmarkWeight?: number;        // 0–1, how useful as an instruction reference
  indoor: boolean;
  schematic?: boolean;            // true ⇒ position is approximate (indoor, no floor plan)
}

export type EdgeKind =
  | "walkway" | "road_crossing" | "corridor" | "door"
  | "stairs" | "elevator" | "ramp";

export interface GraphEdge {
  id: string;
  from: string; to: string;
  bidirectional: boolean;         // default true; one-way doors/turnstiles = false
  kind: EdgeKind;
  via?: [number, number][];       // intermediate polyline points (metres) so curved walkways need no extra nodes
  lengthM?: number;               // override; else computed from the polyline
  floorDelta?: number;            // stairs/elevator: +2 means from floor 0 to 2
  accessible: boolean | null;     // true = step-free, false = has steps, null = unknown
  covered?: boolean;              // shaded/indoor (future "prefer shade" profile, very relevant in RAK)
  closed?: boolean;               // temporarily closed (maintenance)
  cues?: { forward?: string; backward?: string }; // e.g. "through the glass doors"
}

export type PlaceType =
  | "building" | "room" | "department" | "facility" | "landmark"
  | "service" | "parking" | "gate" | "residence" | "sports";

export interface Place {
  id: string;                     // "place.library"
  type: PlaceType;
  name: string;                   // "Saqr Library"
  buildingId?: string;
  floor?: number;
  roomCode?: string;              // "G204"
  departments?: string[];         // ["Computer Science", "Electrical Engineering"]
  facilities?: string[];          // ["wifi", "printing", "prayer-room", "accessible-restroom"]
  aliases: string[];
  description?: string;
  anchors: string[];              // node ids you can arrive at (multiple entrances ⇒ nearest one wins)
  startable: boolean;             // can be chosen as "Where are you?"
  image?: string;
  i18n?: { ar?: { name: string; aliases?: string[] } }; // Arabic-ready, not required in v1
}
```

### 3.3 Why this beats the draft structure

- **`Place.anchors[]`**: "Go to Saqr Library" routes to the *closest* of its entrances. Rooms anchor to a room node. Departments anchor to the room or office node.
- **`via[]` polylines**: walkways bend without inventing nodes. The drawn route follows the real path.
- **`direction` is not stored on edges.** Direction depends on where you came from, so it is **computed** (§7). Storing "straight" on an edge is wrong half the time.
- **`accessible: true | false | null`**: unknown ≠ accessible. The UI can say "step-free status unverified".
- **`floorDelta` + `kind`** turn indoor vertical movement into first-class instructions.
- **`levels[]` + `map.json` features**: floor plans (same feature model) and other campuses need no schema change.

### 3.4 Files (v1)

```
src/campus-data/aurak/
  campus.json      // campus + levels
  map.json         // vector map features (metres), the map users see
  buildings.json
  nodes.json
  edges.json
  places.json
  reference/       // EDITOR ONLY: campus-reference.jpg + reference.json (control points)
```
`StaticJsonRepository` merges them into a `CampusBundle` and validates with zod. **The app refuses to boot with invalid data** and shows the validator's error list in dev.

### 3.5 Room code convention — 🔮 FUTURE FEATURE (on hold, do not build in v1)

> In v1, `Place.type` is never `"room"`, no indoor nodes exist, and `floorDelta`/stairs/elevator edges aren't used. Keep the fields in the schema as optional so rooms can be added later without migrations.

AURAK uses building letters. Proposed room codes are `<Letter><Floor><Room>`, e.g. `G204` = Building G, floor 2, room 04. `domain/search/roomCode.ts` parses `/^\s*([A-Z])\s*-?\s*(\d)(\d{2,})\s*$/i`. Even if a specific room isn't in the data yet, search can answer *"G204 → School of Engineering and Computing (Building G), Floor 2"* and route to that building's entrance, followed by a schematic indoor step. Real room lists come from the user as CSV per building (Phase 3).

---

## 4. Generating the real, interactive campus map

### 4.1 Pipeline

```
campus-reference.jpg ──(4+ control points → homography H)──► warped top-down underlay (editor only)
                                                                   │  trace with editor tools
                                                                   ▼
                                     map.json (features in metres) + buildings/nodes/edges/places
                                                                   │
                                                                   ▼
                                     <CampusMap> SVG renderer (users see only this)
```

### 4.2 Homography (picture → top-down metres)

- `domain/geometry/homography.ts`: `solveHomography(points: {image, map}[])` via DLT. For exactly 4 points it's an 8×8 linear solve; for more, least squares (normal equations). Plus `applyH` / `invertH`. Unit tests use a synthetic square warped by a known H.
- Control points (`campus-data/aurak/reference/reference.json`): the **4 site boundary corners** (map coords `[0,0] [L,0] [L,W] [0,W]`) plus the **4 football-pitch corners** as a check. Start with L ≈ 800, W ≈ 350 and adjust so the pitch measures ≈ 105 × 68 m. The editor shows the pitch's measured size live.
- **Editor underlay:** render the `<img>` with CSS `transform: matrix3d(...)` built from H. CSS supports projective transforms natively, so no image processing is needed. Opacity slider, toggle on/off.
- Acceptance: after warping, the site boundary is a rectangle, walkways look straight and perpendicular, and the pitch has a ≈ 105:68 ratio.

### 4.3 Map geometry model (`map.json`)

```ts
export type FeatureLayer =
  | "boundary" | "future_zone" | "road" | "road_marking" | "parking" | "parking_bay"
  | "lawn" | "field" | "court" | "plaza" | "walkway" | "canopy"
  | "building" | "tree" | "palm" | "gate" | "fence";

export type Geometry =
  | { type: "Polygon"; coordinates: [number, number][][] }                 // metres, outer ring first
  | { type: "LineString"; coordinates: [number, number][]; widthM?: number }
  | { type: "Point"; coordinates: [number, number] };

export interface MapFeature {
  id: string;
  layer: FeatureLayer;
  geometry: Geometry;
  buildingId?: string;     // building footprints ↔ Building
  heightM?: number;        // buildings/canopies: drives the soft 2.5D shadow + optional extrusion
  variant?: string;        // "football" | "running_track" | "courts" | "shade_sails" | "round" ...
  label?: string;          // lawn/field/plaza names ("Green Lawn")
}
export interface CampusMapData { levelId: string; bounds: { width: number; height: number }; features: MapFeature[] }
```

`Building.footprint` is dropped. The footprint is the `building` feature with that `buildingId`. `Building.labelAt` becomes a point in metres (default: polygon centroid).

### 4.4 Rendering (users see this)

One `<svg>` in metres, drawn back to front:

1. **Ground:** site background, `future_zone` (subtle diagonal hatch + "Future expansion" label), `fence` lines.
2. **Roads:** asphalt fill, dashed centre `road_marking`, gate symbol at Gate 1.
3. **Parking:** fill + `parking_bay` strokes + a "P" icon.
4. **Green:** lawns (soft green), fields with procedural markings by `variant` (football pitch lines generated from the polygon's bounding box, running track, courts).
5. **Hardscape:** plazas (light paving) and walkways (white with a hairline edge).
6. **Canopies** (translucent), e.g. the round pavilion and shade sails at 11.
7. **Building shadows:** the footprint offset by `heightM × k` toward one light direction, blurred at low opacity (2.5D depth without clutter).
8. **Buildings:** white/near-white fill, crisp outline, and a thin category tint band (academic, services, residence, sports). Hover/selected/route states come from CSS classes.
9. **Trees/palms:** small circles or palm glyphs. They thin out at low zoom.
10. **Route layer:** casing + line + flow dashes + walker dot + step bubbles.
11. **Markers:** start pulse and destination pin.
12. **Labels (screen-space):** number badge (legend number, e.g. "5") + short name. They counter-scale and counter-rotate so text stays upright and fixed-size. Lower-priority labels hide on collision at low zoom (the priority order is data).

**Camera:** custom `useMapCamera` holding `{ centerX, centerY, zoom, rotationDeg }` as Motion springs. Gestures come from `@use-gesture/react`: drag, wheel/pinch zoom (0.6×–10×), two-finger rotate, double-tap zoom. It's applied as one `<g transform>`, and route and outlines use `vector-effect="non-scaling-stroke"`. It exposes `fitBounds(bbox, {padding, rotation})` and `flyTo`.

**Palette (light):** ground `#F3F1EC`, walkway `#FFFFFF`/edge `#E2DDD2`, plaza `#EAE6DD`, lawn `#CFE5C3`, field `#B7D9A0` + white lines, road `#D5D6DB` + white dashes, parking `#E4E5E9`, building `#FFFFFF` with outline `#1F2937` @ 18%, shadow `#0B1220` @ 10%, route `#1D4ED8` with white casing, start `#16A34A`. Dark theme swaps the tokens (ground `#0E1420`, buildings `#1B2433`, route `#60A5FA`). All colours are CSS variables, so the map follows the app theme.

**Interactive behaviour (v1 priority):**
- Hover/tap a building: lift effect (shadow grows, outline thickens) + a floating card (number, name, code, "Navigate here", "I'm here"). Tap two buildings for a full route.
- Home is **map-first**: the pickers float over the live map and stay synced with map taps.
- With a route: non-route buildings fade to 55% opacity, the destination footprint is tinted, and the route draws on (≈900 ms). The walker dot loops in Map View.
- Camera choreography: fit the whole route, then fly to step 1. Next/Prev flies to that step's segment.
- **Guide View heading-up:** the mini map rotates so the direction of travel points up, and the big arrow matches what the map shows. A compass chip resets to north-up.
- `prefers-reduced-motion` gives instant camera moves and no loops.

### 4.5 Editor, `/editor` (dev-only; Phase 1 v0, grows into Admin in Phase 4)

- **Reference mode:** place the 4+ control points (drag on the picture, type map coords), with a live pitch-size readout and underlay opacity.
- **Draw mode:** pick a layer, then use the **rotated-rectangle tool** (snaps to the site axes, which fits most buildings), polygon tool, polyline tool (width in metres for walkways/roads), and point tool (trees). Vertex snap, 15° angle snap, edit vertices, duplicate, delete.
- **Graph mode:** add/move nodes, connect edges, add `via` points. Snaps to walkway centrelines.
- **Data panels:** building link and properties, place properties, node/edge properties.
- Validate · Import/Export JSON · localStorage autosave · **Review sheet** (`?review=1`): labelled edge ids, node numbers, and a side-by-side view with the reference picture.
- Gated by `import.meta.env.DEV`. The reference image is imported only from the editor chunk, so it never ships to users.

### 4.6 Review workflow (Claude drafts → user corrects)

1. **Map review:** Claude traces `map.json`, then screenshots the rendered map next to the reference picture and sends both to the user (SendUserFile). The user says things like *"building 9 is bigger"*, *"there's a path between 3 and 5"*, *"that's not parking"*.
2. **Pathway review:** Claude drafts the walkway graph, then sends a review-sheet screenshot with edge ids. The user says things like *"e12 is grass"*, *"people cut across the lawn from 3 to 5"*, *"entrance of 8 faces the lawn"*.
3. Apply fixes, re-screenshot, and repeat until approved. The user can also edit directly in `/editor`.

### 4.7 Validator (`domain/validate/validateCampus.ts`, also `npm run validate:campus`)

Errors: edge references a missing node · duplicate ids · place without anchors or with unknown anchors · building without a footprint feature · feature outside the site bounds · invalid polygon (self-intersecting, < 3 points).
Warnings: disconnected graph components · a place unreachable from Gate 1 · a graph node inside a building polygon (except `entrance`/`door` on its edge) · an edge that mostly runs outside walkway/plaza/lawn polygons · zero-length edges · `accessible: null` count.

## 5. How the routing graph works

- `buildGraph(bundle, profile)` creates an adjacency list `Map<nodeId, OutEdge[]>`. Bidirectional edges produce two directed half-edges. Each half-edge stores `{ to, edgeId, reversed, lengthM, costS }`.
- **Edge cost is time in seconds, not metres.** Stairs, elevators, doors, and road crossings then compare fairly:

| kind | cost (seconds) |
|---|---|
| walkway / corridor / ramp | `lengthM / speed` |
| door | `lengthM / speed + 3` |
| road_crossing | `lengthM / speed + 15` |
| stairs | `abs(floorDelta) × 18` (default) · **excluded** in accessible mode |
| elevator | `20 wait + abs(floorDelta) × 6` (default) · preferred in accessible mode |
| `closed: true` | excluded always |

- **Route profiles** (`domain/graph/costs.ts`):
  - `default`: fastest.
  - `accessible`: hard-exclude `accessible === false`, penalise `accessible === null` ×1.5, speed 1.0 m/s. **If no route exists**, re-run with stairs allowed but penalised ×10, and return `warnings: ["No fully step-free route found. This route includes stairs at <place>."]`.
  - Future: `shaded` (prefer `covered`), `avoidOutdoor`.
- **Multi-anchor destinations and starts:** run A* from *all* start anchors (seed the open set with each at g=0) to the *set* of goal anchors. The heuristic is the minimum distance to any goal. One run finds the best entrance.

---

## 6. A* implementation

File `src/domain/graph/astar.ts`, with a binary-heap `PriorityQueue` in `priorityQueue.ts` (no dependency).

```ts
export interface AStarResult { nodeIds: string[]; halfEdges: HalfEdge[]; costS: number }

export function aStar(
  graph: Graph,
  starts: string[],
  goals: Set<string>,
  heuristicS: (nodeId: string) => number,   // admissible: straight-line ground distance / maxSpeed
): AStarResult | null {
  const g = new Map<string, number>();
  const cameFrom = new Map<string, { prev: string; edge: HalfEdge }>();
  const open = new PriorityQueue<string>();          // keyed by f = g + h
  const closed = new Set<string>();

  for (const s of starts) { g.set(s, 0); open.push(s, heuristicS(s)); }

  while (open.size) {
    const current = open.pop()!;
    if (closed.has(current)) continue;               // lazy deletion (stale heap entries)
    if (goals.has(current)) return reconstruct(current, cameFrom, g.get(current)!);
    closed.add(current);

    for (const e of graph.out(current)) {
      if (closed.has(e.to)) continue;
      const tentative = g.get(current)! + e.costS;
      if (tentative < (g.get(e.to) ?? Infinity)) {
        g.set(e.to, tentative);
        cameFrom.set(e.to, { prev: current, edge: e });
        open.push(e.to, tentative + heuristicS(e.to));
      }
    }
  }
  return null;
}
```

- **Heuristic:** `h(n) = min over goals of groundDistanceM(n, goal) / fastestSpeedMps`. It stays admissible because no edge is faster than walking at the fastest speed. Vertical edges have zero ground distance, so h does not overestimate. For a goal on a different floor, optionally add `abs(floorDiff) × minVerticalCostPerFloor` (still admissible).
- **Tests (`astar.test.ts`):** hand-built 6–8 node fixture. Covers the shortest path, a stairs-vs-elevator choice under both profiles, closed edges, an unreachable goal (null), multi-goal nearest entrance, and equivalence with a Dijkstra reference (h = 0) on the real AURAK graph for 50 random pairs (same cost).
- The campus graph is a few hundred nodes, so A* runs in under 1 ms. Re-plan on every profile toggle. No web worker needed.

`planRoute(bundle, fromPlaceId, toPlaceId, profile) → Route`:
```ts
interface Route {
  from: Place; to: Place; profile: RouteProfile;
  legs: RouteLeg[];            // one per half-edge, with ground-projected polyline + lengthM + costS
  totalM: number; totalS: number;
  steps: Step[];               // from instructions generator
  warnings: string[];
  bbox: [number, number, number, number];
}
```

---

## 7. Generating directional instructions automatically

File `src/domain/instructions/generateSteps.ts`. Input: `Route` legs. Output: `Step[]`.

### 7.1 Pipeline

1. Leg polylines are already in map metres (no projection needed).
2. **Segment headings:** for each leg, compute the *entry* heading (first 5 m of the polyline) and the *exit* heading (last 5 m). Using the ends, not the chord, keeps curved walkways from producing false turns.
3. **At each node between two legs**, compute the signed turn angle:
   ```ts
   const cross = a.x * b.y - a.y * b.x;   // ground frame is y-down like the image ⇒ cross > 0 = RIGHT
   const dot   = a.x * b.x + a.y * b.y;
   const angleDeg = Math.atan2(cross, dot) * 180 / Math.PI;   // (-180, 180]
   ```
4. **Classify** (`classifyTurn.ts`):

   | |angle| | maneuver |
   |---|---|
   | < 25° | `straight` (continue) |
   | 25–60° | `slight_left` / `slight_right` |
   | 60–135° | `left` / `right` |
   | 135–170° | `sharp_left` / `sharp_right` |
   | ≥ 170° | `u_turn` |

   Sign: positive = right.
5. **Vertical and transition events override turns:** a `stairs` leg becomes `stairs_up`/`stairs_down` (with target floor), `elevator` becomes `elevator` (with target floor), `ramp` becomes `ramp`, crossing an entrance node from outdoor to indoor becomes `enter_building`, and indoor to outdoor becomes `exit_building`.
6. **Merge:** consecutive `straight` legs collapse into one step with summed distance. Turns under ~4 m apart at junction clutter merge into the next significant maneuver. Stairs or elevator directly after entering a building merge into "Enter Saqr Library, then take the stairs to Floor 2" only when the combined step stays short (the Guide View shows one maneuver per screen; keep them separate if in doubt).
7. **Landmarks:** for each turn node, choose a reference in this order: (a) the node's own `name`, (b) the nearest node or building with `landmarkWeight ≥ 0.5` within 25 m ground distance, (c) none. Result: *"Turn right at the Central Plaza"*, *"Turn left after Saqr Library"*.
8. **First step (no prior heading):** since there's no GPS, the user's facing direction is unknown. Never say "go straight" as the first step. Instead, orient them with a visible reference: *"Walk toward Saqr Library"* (the most salient landmark ahead along the first 60 m), or use the start node's authored `cues.forward` (e.g. *"With the Main Gate behind you, walk along the palm-lined path"*). The Guide View arrow for step 1 shows a **"head toward" glyph + landmark name**, not an egocentric arrow.
9. **Arrival side:** take the final approach vector `a` and the vector `d` from the last path point to the destination's `labelAt`/door. `sign(cross(a, d))` gives "on your right" / "on your left", and |angle| < 20° gives "ahead".
10. **Distance and time phrasing:** round to 5 m under 50 m, to 10 m above that. Always prefix "about" (the map is traced, not surveyed). Time = `ceil(totalS / 60)` min.

### 7.2 Step type

```ts
type Maneuver =
  | "depart" | "straight" | "slight_left" | "slight_right" | "left" | "right"
  | "sharp_left" | "sharp_right" | "u_turn"
  | "stairs_up" | "stairs_down" | "elevator" | "ramp"
  | "enter_building" | "exit_building" | "arrive";

interface Step {
  index: number;
  maneuver: Maneuver;
  title: string;          // "TURN RIGHT"
  detail: string;         // "Walk about 20 m past the Central Plaza"
  distanceM?: number;
  toFloor?: number;
  landmark?: string;
  arrivalSide?: "left" | "right" | "ahead";
  legRange: [number, number];   // which route legs this step covers (Map View highlights them)
  focusPoint: [number, number]; // map-unit point to center on for this step
}
```

### 7.3 Phrasing (`phrasing.ts`, kept separate so i18n/Arabic plugs in later)

| maneuver | title | detail example |
|---|---|---|
| depart | HEAD TOWARD {landmark} | "Walk about 40 m" |
| straight | GO STRAIGHT | "Continue about 40 m" |
| right / left | TURN RIGHT / TURN LEFT | "at the Central Plaza · walk about 20 m" |
| slight_* | KEEP RIGHT / KEEP LEFT | "about 15 m" |
| stairs_up | TAKE THE STAIRS | "Go up to Floor 2" |
| elevator | TAKE THE ELEVATOR | "Go to Floor 2" |
| enter_building | ENTER {building} | "through the main entrance" |
| arrive | YOU HAVE ARRIVED | "Room G204 is on your right" |

**Golden tests:** `generateSteps.test.ts` snapshots instructions for 6–8 real AURAK routes (Gate 1 → Library, Gate 1 → G204 accessible, Residence 6 → Business School, Parking → Mosque, etc.). A human reviews them once against the map, then they guard against regressions.

---

## 8. Arrow-based navigation UI

### 8.1 Screens

**Home `/`**
- Hero: "University Navigator: Find your way around AURAK."
- Two stacked pickers joined by a vertical dotted connector, with a ⇅ swap button: **Where are you?** / **Where do you want to go?**
- Picker: a full-screen sheet on mobile, a popover on desktop. It contains a search input, **Recent** (localStorage, max 5), **Popular** (gate, library, admissions, parking), and results grouped by type with icon, name, and secondary line ("Building G · Floor 2").
- "Step-free route" toggle (accessibility icon).
- **START NAVIGATION** button, disabled until both are set and not equal.

**Navigate `/navigate?from&to&mode&view&step`**
- Top bar: from → to (tap to edit), total distance, time, step-free badge, **Map | Guide** segmented toggle.
- **Map View:** full-bleed map with the route drawn. A bottom sheet (mobile) or right panel (desktop) shows the *current* step card (small arrow + title + detail), Prev/Next, a **Recenter** FAB, and a collapsible full step list.
- **Guide View:** one instruction per screen, described below.
- Keyboard: ←/→ = prev/next, M/G = switch view, R = recenter. Swipe left/right on mobile.

**Place details `/place/:id`**: name, building/code, floor, description, facilities chips, "Navigate here" / "Start from here" buttons, and a mini map with the building highlighted.

### 8.2 Guide View layout

```
┌──────────────────────────────────────┐
│  STEP 2 / 7              ◯◯●◯◯◯◯    │  progress dots
│                                      │
│                                      │
│               ╱▔▔▔╲                  │
│              ╱  ➜  ╲   ← giant arrow │  ~40–50% of viewport height
│                                      │
│            TURN RIGHT                │  48–64px, 800 weight, tracking tight
│   at the Central Plaza · about 20 m  │  20–24px
│                                      │
│  ┌──────── mini map strip ─────────┐ │  auto-zoomed on this step's legs
│  └──────────────────────────────────┘│
│   [ ← PREV ]            [ NEXT → ]   │  large tap targets (≥56px)
└──────────────────────────────────────┘
```

### 8.3 `<DirectionArrow maneuver toFloor />`

One SVG component. **Standard maneuvers share one arrow shape** that rotates, so moving between steps animates the rotation (e.g. straight → right spins 90° on a spring). Special maneuvers swap glyphs.

| maneuver | glyph | rotation |
|---|---|---|
| straight | bold up-arrow | 0° |
| slight_right / slight_left | same arrow | +45° / −45° |
| right / left | same arrow with a curved shaft | +90° / −90° |
| sharp_right / sharp_left | same | +135° / −135° |
| u_turn | U-turn glyph | — |
| depart | arrow + target ring ("head toward"), landmark name under it | 0° |
| stairs_up / stairs_down | stairs glyph + animated chevrons climbing, floor badge "2" | — |
| elevator | elevator doors glyph + up/down indicator + floor badge | — |
| enter_building | doorway glyph with arrow entering | — |
| arrive | destination pin with expanding ripple rings + confetti-free check | — |

Animation (Motion):
- Rotation: `animate={{ rotate }}`, `transition={{ type: "spring", stiffness: 180, damping: 18 }}`.
- Idle "keep going" cue: the chevron inside the arrow translates 8 px forward, loops every 1.6 s.
- Step change: `AnimatePresence mode="wait"`. The card slides in from the right on Next and from the left on Prev (x ±40, opacity 0 → 1, 220 ms). Text updates 60 ms after the arrow starts rotating.
- `useReducedMotion()` removes loops and slides and keeps short opacity fades.

**Arrows are egocentric.** "Right" means the user's right given their heading along the route, which is why turns come from the ground-frame angle and not from the map's orientation. The Map View never rotates (the isometric image has baked-in text).

### 8.4 Visual design direction

- A clean, institutional, high-contrast "wayfinding signage" feel. Think airport signage, not a dashboard.
- Neutral light UI (`#F7F7F5` ground, `#0B1220` ink) with one strong route blue. A dark mode is optional in Phase 3 (the map image stays light, so the map canvas keeps a light frame).
- Type: **Inter** or **Geist** (tabular numbers for distances). Guide titles use all caps, weight 800.
- Minimum body 16 px, WCAG AA contrast (AAA for Guide View text), focus rings visible, everything keyboard-operable.
- Arrow colour: ink on light background, or white on route-blue disc. It must pass contrast both ways.

### 8.5 Accessibility of the app itself
- `aria-live="polite"` region announces each new step ("Step 2 of 7. Turn right at the Central Plaza. About 20 metres.").
- Arrow SVG has `role="img"` + `aria-label`.
- The step list is a real ordered list, and the map has a text alternative (the list).

### 8.6 QR codes (the no-GPS answer to "Where are you?")
Print QR codes at gates, lobbies, and signboards that encode `/?from=<placeId>`. Scanning one pre-fills the start location. This needs no tracking, only a URL param (Phase 3).

---

## 9. Project folder structure

```
university-navigator/
├─ docs/
│  └─ PLAN.md                         ← this file
├─ public/
│  └─ (favicon, og image)
├─ scripts/
│  └─ validate-campus.ts              ← npm run validate:campus
├─ src/
│  ├─ main.tsx
│  ├─ app/
│  │  ├─ App.tsx  routes.tsx
│  │  └─ CampusProvider.tsx           ← loads + validates bundle, builds search index & graph (memoised)
│  ├─ campus-data/
│  │  └─ aurak/ campus.json map.json buildings.json nodes.json edges.json places.json
│  │           reference/ campus-reference.jpg reference.json   ← editor only
│  ├─ data/
│  │  ├─ CampusRepository.ts          ← interface: getBundle(campusId): Promise<CampusBundle>
│  │  └─ StaticJsonRepository.ts
│  ├─ domain/                         ← PURE TS. No React imports allowed here.
│  │  ├─ schema.ts  types.ts
│  │  ├─ geometry/  homography.ts vector.ts polyline.ts polygon.ts (+ .test.ts)
│  │  ├─ graph/     buildGraph.ts astar.ts priorityQueue.ts costs.ts (+ tests, fixtures/)
│  │  ├─ routing/   planRoute.ts (+ test)
│  │  ├─ instructions/ generateSteps.ts classifyTurn.ts landmarks.ts phrasing.ts (+ tests)
│  │  ├─ search/    searchIndex.ts roomCode.ts normalize.ts (+ tests)
│  │  └─ validate/  validateCampus.ts (+ test)
│  ├─ features/
│  │  ├─ home/            HomePage.tsx
│  │  ├─ location-picker/ LocationPicker.tsx LocationSearchSheet.tsx useRecentPlaces.ts
│  │  ├─ map/             CampusMap.tsx useMapCamera.ts mapTheme.ts
│  │  │  └─ layers/       GroundLayer RoadsLayer ParkingLayer GreenLayer (field markings) HardscapeLayer
│  │  │                   ShadowsLayer BuildingsLayer TreesLayer RouteLayer MarkersLayer LabelsLayer
│  │  ├─ navigation/      NavigatePage.tsx useNavigationParams.ts StepPanel.tsx StepList.tsx RouteSummaryBar.tsx
│  │  ├─ guide/           GuideView.tsx DirectionArrow.tsx StepCard.tsx MiniMapStrip.tsx
│  │  ├─ place/           PlacePage.tsx
│  │  └─ editor/          EditorPage.tsx (dev-only) ReferenceUnderlay.tsx tools/ (rect, polygon, line, point, graph) panels/ useEditorDraft.ts
│  ├─ ui/                 Button.tsx SegmentedControl.tsx Sheet.tsx Toggle.tsx Kbd.tsx
│  └─ styles/             index.css (tailwind + tokens)
├─ index.html  vite.config.ts  tsconfig.json  package.json
└─ README.md
```

Rule: `features/*` may import `domain/*`, `data/*`, and `ui/*`. `domain/*` imports nothing from the app. An ESLint `no-restricted-imports` rule enforces this.

---

## 10. Development plan (incremental, with stop points)

Each phase ends with **acceptance criteria**. Verify in the browser and run `npm test` before moving on.

### Phase 0: Scaffold (≈ 1 session)
1. `npm create vite@latest . -- --template react-ts` inside `C:\Users\arabi\university-navigator` (keep the existing `docs/` and `src/campus-data/aurak/reference/`).
2. Add Tailwind v4 (`@tailwindcss/vite`), `react-router`, `motion`, `@use-gesture/react`, `fuse.js`, `zod`, `lucide-react`. Dev: `vitest`, `@testing-library/react`, `jsdom`.
3. Set up TS strict, path alias `@/` → `src/`, the ESLint import boundary, tokens in `index.css`, and `.claude/launch.json` for the dev server.
4. `git init`, first commit. **No Co-Authored-By trailer in this user's repos.**

✅ `npm run dev` serves a blank shell. `npm test` runs one sample test.

### Phase 1: Real vector map (≈ 3 sessions) ⭐
1. `domain/geometry/homography.ts` + tests. `reference.json` with Claude's estimated control points (4 site corners + 4 pitch corners).
2. `domain/schema.ts` (incl. `MapFeature`) + `StaticJsonRepository` + `CampusProvider`, with validation errors shown in dev.
3. **Editor v0** (`/editor`, dev-only): warped reference underlay (CSS `matrix3d`) with opacity, control-point mode with pitch readout, rotated-rectangle / polygon / polyline / point tools, layer picker, select & edit vertices, import/export, localStorage autosave.
4. **Trace the whole campus** into `map.json`: boundary, future zones, roads + gate, parking 16 + bays, Green Lawn 14 + other lawns, fields 11/12 (+ track), central plaza + pavilion canopy, walkways, all 22 legend buildings/residences as footprints (at the **base**), `heightM` estimates, trees/palms. Fill `buildings.json` + `places.json` for all 22.
5. **`<CampusMap>` renderer** (§4.4): all layers, palette tokens (light + dark), procedural field markings, 2.5D shadows, screen-space labels with collision hiding, custom camera (pan/zoom/rotate, fitBounds, flyTo).
6. Building interaction: hover/tap lift + info card with "Navigate here" / "I'm here".
7. **🛑 Map review with user** (§4.6 step 1): send rendered-map + reference-picture screenshots, apply corrections until approved.

✅ The app shows a clean, professional top-down campus map that clearly matches the real campus. All 22 places are visible, labelled, and clickable. It zooms, pans, and rotates smoothly on phone and desktop. The user approved the map.

### Phase 1.5: Routes on the map (≈ 2 sessions) ⭐
1. Editor graph mode: nodes, edges, `via` points, snap to walkway centrelines, properties panel, `?review=1` review sheet.
2. Draft the walkway graph. Every place gets ≥1 anchor at its entrance side.
3. `graph/` + `astar.ts` + `planRoute` (time-based costs in metres/seconds) + tests. `validateCampus` + `npm run validate:campus`.
4. Home: map-first with floating pickers (simple filtered list) **plus** tap-two-buildings, synced both ways → `/navigate?from&to`.
5. `RouteLayer`: draw-on animation, walker dot, start/destination emphasis, non-route buildings faded, fit-route camera.
6. **🛑 Pathway review with user** (§4.6 step 2).

✅ Tapping Gate 1, then Saqr Library, animates a route along real walkways. Every pair of the 22 places routes sensibly. The validator shows 0 errors. The user approved the pathways.

### Phase 2: Step-by-step guide with big arrows (≈ 2–3 sessions) ⭐
1. `generateSteps` pipeline (§7), *outdoor maneuvers only*: depart, straight, slight/left/right/sharp, u_turn, arrive. Landmarks use building names ("Turn right at Saqr Library"). Golden tests for ~8 building pairs.
2. Approximate totals: "about 3 min walk · about 220 m".
3. **Guide View** with `DirectionArrow` (spring rotation, idle forward pulse), step transitions, progress dots, Prev/Next, keyboard and swipe, a **heading-up rotating mini map** focused on the current segment, and a "You have arrived" screen that highlights the destination building.
4. **Map View** step panel: numbered step bubbles on the route, current segment emphasised, completed legs dimmed, camera flies per step, Recenter button.
5. The `step` URL param is kept in sync, so refresh and Back work.

✅ For any two buildings, the steps read sensibly (the user spot-checks a few). Arrow and map rotation agree. Map ↔ Guide toggle keeps the current step. Reduced-motion is respected.

### Phase 3: Search, mobile polish, extras (≈ 2 sessions)
1. Search: Fuse index over places (name, building code "G", legend number "5", aliases like "engineering", "admissions", "masjid", "dorms"). Recents and popular.
2. Filter chips: Academic · Services · Sports · Residences · Parking.
3. Place Details sheet (opens from a map tap): name, code, number, description, "Navigate here".
4. QR deep links `/?from=` + a printable `/qr` sheet.
5. Responsive pass (360 px → 1440 px), bottom sheet on mobile, safe areas, one-handed use. Theme toggle (light/dark map).
6. Aria-live step announcements, focus management, keyboard pass, contrast audit.
7. Optional: **3D/2.5D view toggle** (buildings extruded by `heightM` with a tilted camera, pure SVG/CSS), "step-free route" toggle once the user marks inaccessible paths, Arabic/RTL scaffold.

✅ Searching "library", "5", "G", "engineering", "admission", or "mosque" returns correct top results. Everything works one-handed on a phone.

### 🔮 Future: Room directory (on hold)
Room codes (§3.5), room CSV import, indoor nodes (entrance → stairs/elevator → floor → room), stairs/elevator maneuvers, **floor-plan levels drawn with the same `MapFeature` model** (`levels[]` with `kind: "floorplan"`), floor switcher, step-free profile with elevators. The schema already supports it.

### Phase 4: Backend + Admin (only when needed)
1. `server/` (Fastify or Express, TS) + PostgreSQL + Drizzle. Tables:
   ```
   campuses(id, name, short_name, settings jsonb)
   map_levels(id, campus_id, kind, building_id, floor, bounds jsonb, reference jsonb)
   map_features(id, campus_id, level_id, layer, geometry jsonb, building_id, height_m, variant, label)
   buildings(id, campus_id, code, map_number, name, aliases text[], floors int[], footprint jsonb, label_at jsonb)
   nodes(id, campus_id, level_id, kind, x, y, floor, building_id, name, landmark_weight, indoor, schematic)
   edges(id, campus_id, from_node, to_node, bidirectional, kind, via jsonb, length_m, floor_delta,
         accessible boolean NULL, covered, closed, cues jsonb)
   places(id, campus_id, type, name, building_id, floor, room_code, departments text[], facilities text[],
          aliases text[], description, anchors text[], startable, i18n jsonb)
   campus_versions(id, campus_id, version, status['draft'|'published'], bundle jsonb, published_at, published_by)
   admins(id, email, password_hash, role)
   route_events(id, campus_id, from_place, to_place, profile, created_at)   -- anonymous, no IP, no user id
   ```
2. Endpoints: `GET /api/campuses/:id/published` (the CampusBundle JSON, cached with ETag), admin CRUD on drafts, `POST /api/campuses/:id/publish` (runs `validateCampus` server-side, which reuses `src/domain`, and blocks on errors).
3. The Editor becomes `/admin` behind login, editing drafts through the API instead of localStorage.
4. `ApiRepository` implements `CampusRepository`. The frontend switches with one env var. **No change to routing or UI.**
5. Map editing in the admin: same draw tools as `/editor`, saved to `map_features` drafts. Optional reference-picture upload for tracing new areas.
6. Analytics dashboard: popular destinations and "no route found" pairs (these reveal missing edges).

✅ An admin marks an edge `closed` and publishes. Clients get the new bundle and routes avoid that edge.

---

## 11. Open questions for the user (non-blocking; defaults in brackets)

Resolved: ~~higher-res map~~ (none, use as-is) · ~~real dimensions~~ (not needed, approximate) · ~~rooms/floor plans~~ (future).

1. **Map and pathway reviews:** the user checks the traced map (end of Phase 1) and the walkway graph (end of Phase 1.5) from screenshots (§4.6).
2. **Main entrance side of each building:** which side do people actually enter? Asked during the same review. [Side facing the nearest main walkway.]
3. **Off-limits paths:** anything staff-only, locked, or crossing a vehicle road (e.g. parking 16)? [All visible paving walkable.]
4. **Branding:** AURAK colours/logo or neutral "University Navigator"? [Neutral brand, campus name shown.]

---

## 12. Implementer notes (for the coding model)

- Build **one phase at a time**. Don't scaffold later phases early (no server folder before Phase 4).
- **Users never see the reference picture.** It is a tracing aid in `/editor` only. Don't modify it, and don't import it outside the editor chunk.
- **Never use AI image generation for the map.** Every shape is traced from the reference picture.
- Keep `src/domain` pure and tested. If you're about to put routing or turn math in a component, move it to `domain/`.
- All coordinates in JSON are **metres in the top-down map frame** (y down). The homography is only used in the editor.
- Verify visually. Screenshot the rendered map beside the reference picture, trace footprints at building **bases** (not roofs), and keep graph nodes on walkways.
- Don't mention AURAK in code. Campus-specific things live in `campus-data/aurak/`.
- Commit at the end of each phase with a clear message. **Do not add a Co-Authored-By trailer.**
