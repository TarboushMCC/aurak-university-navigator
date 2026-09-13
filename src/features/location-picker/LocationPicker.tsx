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
      className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-1.5 text-left shadow-sm transition-colors duration-200 ease-out hover:border-(--color-gold) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-ground)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-surface)")}
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
