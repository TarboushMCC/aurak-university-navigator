import type { Geometry } from "@/domain/schema";

/** Builds an SVG path `d` string from a Polygon geometry's outer ring(s). */
export function polygonToPath(geometry: Extract<Geometry, { type: "Polygon" }>): string {
  return geometry.coordinates
    .map((ring) => {
      if (ring.length === 0) return "";
      const [first, ...rest] = ring;
      return `M ${first![0]} ${first![1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(" ")} Z`;
    })
    .join(" ");
}

export function lineToPath(coordinates: readonly (readonly [number, number])[]): string {
  if (coordinates.length === 0) return "";
  const [first, ...rest] = coordinates;
  return `M ${first![0]} ${first![1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(" ")}`;
}
