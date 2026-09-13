import { describe, expect, it } from "vitest";

import { buildSearchEntries, createSearchIndex, search } from "@/domain/search/searchIndex";
import { StaticJsonRepository } from "@/data/StaticJsonRepository";

describe("search index against real AURAK data", () => {
  const bundle = new StaticJsonRepository().getBundleSync("aurak");
  const entries = buildSearchEntries(bundle);
  const index = createSearchIndex(entries);

  it("only includes startable places", () => {
    expect(entries.every((e) => e.id)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
    const nonStartable = bundle.places.filter((p) => !p.startable);
    for (const p of nonStartable) {
      expect(entries.some((e) => e.id === p.id)).toBe(false);
    }
  });

  it("finds the library by alias", () => {
    const results = search(index, "library");
    expect(results[0]?.name).toBe("Saqr Library");
  });

  it("finds a building by its map number", () => {
    const results = search(index, "3");
    expect(results.some((r) => r.name === "Saqr Library")).toBe(true);
  });

  it("finds the mosque by alias", () => {
    const results = search(index, "masjid");
    expect(results[0]?.name).toBe("AURAK Mosque");
  });

  it("finds admission and registration by alias", () => {
    const results = search(index, "student affairs");
    expect(results[0]?.name).toBe("Admission and Registration");
  });

  it("tolerates a typo", () => {
    const results = search(index, "libary");
    expect(results[0]?.name).toBe("Saqr Library");
  });

  it("returns nothing for an empty query", () => {
    expect(search(index, "")).toEqual([]);
    expect(search(index, "   ")).toEqual([]);
  });
});
