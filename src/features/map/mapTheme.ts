/** CSS custom property names for the map palette (see src/styles/index.css). */
export const mapVar = {
  ground: "var(--map-ground)",
  future: "var(--map-future)",
  road: "var(--map-road)",
  roadMarking: "var(--map-road-marking)",
  parking: "var(--map-parking)",
  lawn: "var(--map-lawn)",
  field: "var(--map-field)",
  fieldLine: "var(--map-field-line)",
  plaza: "var(--map-plaza)",
  walkway: "var(--map-walkway)",
  walkwayEdge: "var(--map-walkway-edge)",
  canopy: "var(--map-canopy)",
  building: "var(--map-building)",
  buildingOutline: "var(--map-building-outline)",
  buildingShadow: "var(--map-building-shadow)",
  tree: "var(--map-tree)",
  treeCanopy: "var(--map-tree-canopy)",
  route: "var(--map-route)",
  routeCasing: "var(--map-route-casing)",
} as const;

export const CATEGORY_TINT: Record<string, string> = {
  academic: "#6d8fd9",
  services: "#d99a4e",
  residence: "#8f7bd9",
  sports: "#4fae7a",
  facilities: "#9aa4b2",
  landmark: "#d96b6b",
};
