import { useState } from "react";

import { CampusMap } from "@/features/map/CampusMap";
import { useCampus } from "@/app/CampusProvider";

export function HomePage() {
  const campus = useCampus();
  const [startId, setStartId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);

  const startBuilding = campus.buildings.find((b) => b.id === startId);
  const destinationBuilding = campus.buildings.find((b) => b.id === destinationId);

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden">
      <header className="z-10 flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div>
          <p className="text-xs font-semibold tracking-wide text-(--color-ink-muted) uppercase">
            University Navigator
          </p>
          <h1 className="text-lg font-bold text-(--color-ink)">{campus.campus.shortName}</h1>
        </div>
        <div className="hidden max-w-md flex-1 items-center gap-2 text-sm sm:flex">
          <PickerPill label="From" value={startBuilding?.name ?? "Tap a building"} tone="start" />
          <span className="text-(--color-ink-muted)">→</span>
          <PickerPill
            label="To"
            value={destinationBuilding?.name ?? "Tap a building"}
            tone="destination"
          />
        </div>
      </header>

      <div className="relative flex-1">
        <CampusMap
          mapData={campus.map}
          buildings={campus.buildings}
          startBuildingId={startId}
          destinationBuildingId={destinationId}
          onSetStart={(id) => setStartId(id)}
          onSetDestination={(id) => setDestinationId(id)}
        />
      </div>
    </main>
  );
}

function PickerPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "start" | "destination";
}) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-2 rounded-full border px-3 py-1.5"
      style={{ borderColor: "var(--color-border)" }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: tone === "start" ? "var(--color-start)" : "var(--color-destination)" }}
      />
      <span className="shrink-0 text-xs font-medium text-(--color-ink-muted)">{label}</span>
      <span className="truncate text-sm text-(--color-ink)">{value}</span>
    </div>
  );
}
