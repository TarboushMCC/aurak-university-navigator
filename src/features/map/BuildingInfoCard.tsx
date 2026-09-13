import { AnimatePresence, motion } from "motion/react";
import { MapPinCheck, Navigation, X } from "lucide-react";

import { buildingTint } from "@/features/map/mapTheme";

import type { SelectablePlace } from "@/features/map/selectablePlaces";

const CATEGORY_LABEL: Record<string, string> = {
  academic: "Academic",
  services: "Services",
  residence: "Residence",
  sports: "Sports",
  facilities: "Facilities",
  landmark: "Landmark",
};

export function BuildingInfoCard({
  building,
  isStart,
  isDestination,
  onClose,
  onSetStart,
  onSetDestination,
}: {
  building: SelectablePlace;
  isStart: boolean;
  isDestination: boolean;
  onClose: () => void;
  onSetStart: () => void;
  onSetDestination: () => void;
}) {
  const tint = buildingTint(building.id, building.category);

  return (
    <AnimatePresence>
      <motion.div
        key={building.id}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="absolute right-3 bottom-3 left-3 z-10 mx-auto max-w-sm rounded-2xl border p-4 shadow-lg backdrop-blur sm:right-4 sm:bottom-4 sm:left-auto sm:w-80"
        style={{
          background: "color-mix(in srgb, var(--color-surface) 92%, transparent)",
          borderColor: "var(--color-border)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-full p-1 text-(--color-ink-muted) transition-colors duration-200 ease-out hover:bg-(--color-ground)"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3 pr-6">
          {building.mapNumber !== undefined && (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: tint, color: "var(--color-ink)" }}
            >
              {building.mapNumber}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-(--color-ink)">{building.name}</h3>
            <p className="text-xs text-(--color-ink-muted)">
              {CATEGORY_LABEL[building.category] ?? building.category}
              {building.code ? ` · Building ${building.code}` : ""}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onSetStart}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors"
            style={{
              borderColor: isStart ? "var(--color-start)" : "var(--color-border)",
              color: isStart ? "var(--color-start)" : "var(--color-ink)",
              background: isStart ? "color-mix(in srgb, var(--color-start) 10%, transparent)" : "transparent",
            }}
          >
            <MapPinCheck size={15} />
            {isStart ? "You're here" : "I'm here"}
          </button>
          <button
            type="button"
            onClick={onSetDestination}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200 ease-out"
            style={
              isDestination
                ? { background: "var(--color-gold)", color: "var(--color-gold-ink)" }
                : { background: "var(--color-accent)", color: "var(--color-accent-ink)" }
            }
          >
            <Navigation size={15} />
            {isDestination ? "Destination" : "Navigate here"}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
