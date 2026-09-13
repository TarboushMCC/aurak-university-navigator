import { useCallback, useState } from "react";

const STORAGE_KEY = "university-navigator:recent-places";
const MAX_RECENTS = 5;

function readStored(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Most-recently-picked place ids, newest first, capped at five (docs/PLAN.md §8.1). */
export function useRecentPlaces() {
  const [recentIds, setRecentIds] = useState<string[]>(readStored);

  const addRecent = useCallback((placeId: string) => {
    setRecentIds((prev) => {
      const next = [placeId, ...prev.filter((id) => id !== placeId)].slice(0, MAX_RECENTS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private browsing / storage disabled — recents just won't persist.
      }
      return next;
    });
  }, []);

  return { recentIds, addRecent };
}
