import { MapPin } from "lucide-react";

import { mapVar } from "@/features/map/mapTheme";

import type { MapFeature } from "@/domain/schema";

/** Non-building point-of-interest markers (currently: the campus gate). */
export function MarkersLayer({ features, scale }: { features: MapFeature[]; scale: number }) {
  const gates = features.filter((f) => f.layer === "gate" && f.geometry.type === "Point");
  const s = 1 / scale;
  return (
    <g>
      {gates.map((f) => {
        if (f.geometry.type !== "Point") return null;
        const [x, y] = f.geometry.coordinates;
        return (
          <g key={f.id} transform={`translate(${x} ${y}) scale(${s})`}>
            <circle r={5} fill={mapVar.building} stroke={mapVar.route} strokeWidth={1.5} />
            <MapPin
              x={-7}
              y={-16}
              width={14}
              height={14}
              fill={mapVar.route}
              stroke="white"
              strokeWidth={1}
            />
          </g>
        );
      })}
    </g>
  );
}
