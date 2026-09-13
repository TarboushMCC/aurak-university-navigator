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

/**
 * Muted/pastel map-category colors — functional, not the SGA brand colors.
 * Kept deliberately subordinate to the burgundy/gold UI so the campus
 * itself reads as neutral and the brand comes from the surrounding product.
 */
export const CATEGORY_TINT: Record<string, string> = {
  academic: "#dce8f0",
  services: "#e8dcc7",
  residence: "#f0d9a6",
  sports: "#b7d99a",
  facilities: "#d8c8e8",
  landmark: "#f3c8c8",
};

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Cheap deterministic string hash — same building id always maps to the same color. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const buildingTintCache = new Map<string, string>();

/**
 * A per-building color, not just per-category — with 22 buildings spread
 * across only 6 categories (6 residence halls alone), the flat category
 * tint made most buildings on the map visually identical. Each building
 * gets a deterministic hue/lightness nudge off its category's base color,
 * so buildings still read as "academic blue" / "residence purple" at a
 * glance but are individually distinguishable up close.
 */
export function buildingTint(buildingId: string, category: string): string {
  const cacheKey = `${category}:${buildingId}`;
  const cached = buildingTintCache.get(cacheKey);
  if (cached) return cached;

  const base = CATEGORY_TINT[category] ?? "#334155";
  const [h, s, l] = hexToHsl(base);
  const hash = hashStr(buildingId);
  const hueShift = ((hash % 41) - 20) * 1.1; // ~ -22..22 deg
  const satShift = (((hash >> 5) % 21) - 10) / 100; // ~ -0.10..0.10
  const lightShift = (((hash >> 10) % 21) - 10) / 100; // ~ -0.10..0.10
  const nextH = (h + hueShift + 360) % 360;
  const nextS = Math.min(0.85, Math.max(0.35, s + satShift));
  const nextL = Math.min(0.68, Math.max(0.32, l + lightShift));
  const tint = hslToHex(nextH, nextS, nextL);
  buildingTintCache.set(cacheKey, tint);
  return tint;
}
