export interface LocationPickerProps {
  label: string;
  value: string;
  tone: "start" | "destination";
  onClick: () => void;
}

/** The "From" / "To" pill on the home header — tap to search for a place. */
export function LocationPicker({ label, value, tone, onClick }: LocationPickerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-1 items-center gap-2 rounded-full border px-3 py-1.5 text-left transition-colors hover:bg-black/[0.03]"
      style={{ borderColor: "var(--color-border)" }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: tone === "start" ? "var(--color-start)" : "var(--color-destination)" }}
      />
      <span className="shrink-0 text-xs font-medium text-(--color-ink-muted)">{label}</span>
      <span className="truncate text-sm text-(--color-ink)">{value}</span>
    </button>
  );
}
