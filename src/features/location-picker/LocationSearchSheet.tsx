import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";

import { search } from "@/domain/search/searchIndex";
import { CATEGORY_TINT } from "@/features/map/mapTheme";

import type Fuse from "fuse.js";
import type { SearchEntry } from "@/domain/search/searchIndex";
import type { BuildingCategory } from "@/domain/schema";

const CATEGORY_LABEL: Record<BuildingCategory, string> = {
  academic: "Academic",
  services: "Services",
  residence: "Residence",
  sports: "Sports",
  facilities: "Facilities",
  landmark: "Landmark",
};

const CATEGORY_ORDER: BuildingCategory[] = [
  "academic",
  "services",
  "sports",
  "residence",
  "facilities",
  "landmark",
];

const POPULAR_IDS = ["place.gate1", "place.j", "place.d", "place.parking", "place.mosque"];

export interface LocationSearchSheetProps {
  title: string;
  index: Fuse<SearchEntry>;
  entries: SearchEntry[];
  recentIds: string[];
  onSelect: (entry: SearchEntry) => void;
  onClose: () => void;
}

export function LocationSearchSheet({
  title,
  index,
  entries,
  recentIds,
  onSelect,
  onClose,
}: LocationSearchSheetProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<BuildingCategory | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const entriesById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const recents = recentIds.map((id) => entriesById.get(id)).filter((e): e is SearchEntry => Boolean(e));
  const popular = POPULAR_IDS.map((id) => entriesById.get(id)).filter((e): e is SearchEntry => Boolean(e));

  const results = useMemo(() => search(index, query), [index, query]);

  const browseList = useMemo(() => {
    if (!activeCategory) return null;
    return entries
      .filter((e) => e.category === activeCategory)
      .sort((a, b) => (a.mapNumber ?? 99) - (b.mapNumber ?? 99));
  }, [entries, activeCategory]);

  const showingSearch = query.trim().length > 0;
  const list = showingSearch ? results : browseList;

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center sm:p-6">
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 sm:bg-black/25"
        style={{ background: "var(--color-ground)" }}
      />
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="relative z-10 flex h-full w-full flex-col overflow-hidden sm:h-auto sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl sm:border sm:shadow-xl"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <div
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--color-border)", paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div
            className="flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 transition-shadow duration-200 ease-out focus-within:border-(--color-accent) focus-within:shadow-[0_0_0_3px_rgba(139,13,24,0.12)]"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            <Search size={16} className="shrink-0 text-(--color-ink-muted)" />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveCategory(null);
              }}
              placeholder={title}
              className="w-full bg-transparent text-sm text-(--color-ink) outline-none placeholder:text-(--color-ink-muted)"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-(--color-ink-muted)">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-sm font-medium text-(--color-ink-muted)"
          >
            Cancel
          </button>
        </div>

        {!showingSearch && (
          <div className="flex gap-1.5 overflow-x-auto border-b px-4 py-2.5" style={{ borderColor: "var(--color-border)" }}>
            {CATEGORY_ORDER.map((cat) => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory((c) => (c === cat ? null : cat))}
                  className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200 ease-out"
                  style={{
                    borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                    background: active ? CATEGORY_TINT[cat] : "transparent",
                    color: active ? "var(--color-ink)" : "var(--color-ink-muted)",
                  }}
                >
                  {CATEGORY_LABEL[cat]}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {list ? (
            list.length > 0 ? (
              <ResultList entries={list} onSelect={onSelect} />
            ) : (
              <p className="px-3 py-8 text-center text-sm text-(--color-ink-muted)">
                No places match &ldquo;{query}&rdquo;.
              </p>
            )
          ) : (
            <>
              {recents.length > 0 && (
                <Section title="Recent">
                  <ResultList entries={recents} onSelect={onSelect} />
                </Section>
              )}
              <Section title="Popular">
                <ResultList entries={popular} onSelect={onSelect} />
              </Section>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-(--color-ink-muted) uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function ResultList({ entries, onSelect }: { entries: SearchEntry[]; onSelect: (e: SearchEntry) => void }) {
  return (
    <ul>
      <AnimatePresence initial={false}>
        {entries.map((entry) => (
          <motion.li key={entry.id} layout initial={false}>
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 ease-out hover:bg-(--color-ground)"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-(--color-ink)"
                style={{ background: CATEGORY_TINT[entry.category] ?? "#d8c8e8" }}
              >
                {entry.mapNumber ?? "·"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-(--color-ink)">{entry.name}</span>
                <span className="block truncate text-xs text-(--color-ink-muted)">
                  {CATEGORY_LABEL[entry.category]}
                  {entry.code ? ` · Building ${entry.code}` : ""}
                </span>
              </span>
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
