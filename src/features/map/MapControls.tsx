import { Compass, Minus, Plus } from "lucide-react";

export function MapControls({
  onZoomIn,
  onZoomOut,
  onRecenter,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
}) {
  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
      <div
        className="flex flex-col overflow-hidden rounded-xl border shadow-sm"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom in"
          className="flex h-9 w-9 items-center justify-center text-(--color-ink) hover:bg-black/5"
        >
          <Plus size={16} />
        </button>
        <div className="h-px" style={{ background: "var(--color-border)" }} />
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom out"
          className="flex h-9 w-9 items-center justify-center text-(--color-ink) hover:bg-black/5"
        >
          <Minus size={16} />
        </button>
      </div>
      <button
        type="button"
        onClick={onRecenter}
        aria-label="Recenter map"
        className="flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm text-(--color-ink) hover:bg-black/5"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <Compass size={16} />
      </button>
    </div>
  );
}
