import { z } from "zod";

/**
 * Source-of-truth schemas for the campus data model (docs/PLAN.md §3).
 * All geometry is in **map metres**, y-down (see §3.1). Types are inferred
 * from these schemas so validation and TypeScript never drift apart.
 */

const pointSchema = z.tuple([z.number(), z.number()]);

export const campusSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  defaultLevelId: z.string(),
  walkingSpeedMps: z.object({
    default: z.number().positive(),
    accessible: z.number().positive(),
  }),
});
export type Campus = z.infer<typeof campusSchema>;

export const mapLevelSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["site", "floorplan"]),
  buildingId: z.string().optional(),
  floor: z.number().optional(),
  bounds: z.object({ width: z.number().positive(), height: z.number().positive() }),
  defaultView: z
    .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
    .optional(),
  northDeg: z.number().optional(),
});
export type MapLevel = z.infer<typeof mapLevelSchema>;

export const buildingCategorySchema = z.enum([
  "academic",
  "services",
  "residence",
  "sports",
  "facilities",
  "landmark",
]);
export type BuildingCategory = z.infer<typeof buildingCategorySchema>;

export const buildingSchema = z.object({
  id: z.string(),
  code: z.string().optional(),
  mapNumber: z.number().optional(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  floors: z.array(z.number()).default([0]),
  category: buildingCategorySchema,
  heightM: z.number().positive().optional(),
  labelAt: pointSchema.optional(),
  labelPriority: z.number().optional(),
});
export type Building = z.infer<typeof buildingSchema>;

// ---------- map.json: the vector features users actually see (§4.3) ----------

export const featureLayerSchema = z.enum([
  "boundary",
  "future_zone",
  "road",
  "road_marking",
  "parking",
  "parking_bay",
  "lawn",
  "field",
  "court",
  "plaza",
  "walkway",
  "canopy",
  "building",
  "tree",
  "palm",
  "gate",
  "fence",
]);
export type FeatureLayer = z.infer<typeof featureLayerSchema>;

const polygonGeometrySchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(pointSchema).min(3)).min(1),
});
const lineStringGeometrySchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(pointSchema).min(2),
  widthM: z.number().positive().optional(),
});
const pointGeometrySchema = z.object({
  type: z.literal("Point"),
  coordinates: pointSchema,
});
export const geometrySchema = z.discriminatedUnion("type", [
  polygonGeometrySchema,
  lineStringGeometrySchema,
  pointGeometrySchema,
]);
export type Geometry = z.infer<typeof geometrySchema>;

export const mapFeatureSchema = z.object({
  id: z.string(),
  layer: featureLayerSchema,
  geometry: geometrySchema,
  buildingId: z.string().optional(),
  heightM: z.number().positive().optional(),
  variant: z.string().optional(),
  label: z.string().optional(),
});
export type MapFeature = z.infer<typeof mapFeatureSchema>;

export const campusMapDataSchema = z.object({
  levelId: z.string(),
  bounds: z.object({ width: z.number().positive(), height: z.number().positive() }),
  features: z.array(mapFeatureSchema),
});
export type CampusMapData = z.infer<typeof campusMapDataSchema>;

// ---------- graph (nodes/edges) — built out in Phase 1.5 ----------

export const nodeKindSchema = z.enum([
  "gate",
  "entrance",
  "junction",
  "door",
  "stairs",
  "elevator",
  "ramp",
  "room",
  "poi",
  "landmark",
  "parking",
]);
export type NodeKind = z.infer<typeof nodeKindSchema>;

export const graphNodeSchema = z.object({
  id: z.string(),
  kind: nodeKindSchema,
  levelId: z.string(),
  x: z.number(),
  y: z.number(),
  floor: z.number().default(0),
  buildingId: z.string().optional(),
  name: z.string().optional(),
  landmarkWeight: z.number().min(0).max(1).optional(),
  indoor: z.boolean().default(false),
  schematic: z.boolean().optional(),
});
export type GraphNode = z.infer<typeof graphNodeSchema>;

export const edgeKindSchema = z.enum([
  "walkway",
  "road_crossing",
  "corridor",
  "door",
  "stairs",
  "elevator",
  "ramp",
]);
export type EdgeKind = z.infer<typeof edgeKindSchema>;

export const graphEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  bidirectional: z.boolean().default(true),
  kind: edgeKindSchema,
  via: z.array(pointSchema).optional(),
  lengthM: z.number().positive().optional(),
  floorDelta: z.number().optional(),
  accessible: z.boolean().nullable().default(null),
  covered: z.boolean().optional(),
  closed: z.boolean().optional(),
  cues: z.object({ forward: z.string().optional(), backward: z.string().optional() }).optional(),
});
export type GraphEdge = z.infer<typeof graphEdgeSchema>;

// ---------- places (searchable / navigable entities) ----------

export const placeTypeSchema = z.enum([
  "building",
  "room",
  "department",
  "facility",
  "landmark",
  "service",
  "parking",
  "gate",
  "residence",
  "sports",
]);
export type PlaceType = z.infer<typeof placeTypeSchema>;

export const placeSchema = z.object({
  id: z.string(),
  type: placeTypeSchema,
  name: z.string(),
  buildingId: z.string().optional(),
  floor: z.number().optional(),
  roomCode: z.string().optional(),
  departments: z.array(z.string()).optional(),
  facilities: z.array(z.string()).optional(),
  aliases: z.array(z.string()).default([]),
  description: z.string().optional(),
  anchors: z.array(z.string()).default([]),
  startable: z.boolean().default(true),
  image: z.string().optional(),
  mapNumber: z.number().optional(),
});
export type Place = z.infer<typeof placeSchema>;

// ---------- the full bundle ----------

export const campusBundleSchema = z.object({
  schemaVersion: z.literal(1),
  campus: campusSchema,
  levels: z.array(mapLevelSchema),
  map: campusMapDataSchema,
  buildings: z.array(buildingSchema),
  nodes: z.array(graphNodeSchema).default([]),
  edges: z.array(graphEdgeSchema).default([]),
  places: z.array(placeSchema),
});
export type CampusBundle = z.infer<typeof campusBundleSchema>;
