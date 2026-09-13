import { describe, expect, it } from "vitest";

import { generateSteps } from "@/domain/instructions/generateSteps";

import type { PlannedRoute } from "@/domain/routing/planRoute";
import type { CampusBundle } from "@/domain/schema";

function makeBundle(overrides: Partial<CampusBundle> = {}): CampusBundle {
  return {
    schemaVersion: 1,
    campus: { id: "test", name: "Test", shortName: "Test", defaultLevelId: "ground", walkingSpeedMps: { default: 1.3, accessible: 1 } },
    levels: [{ id: "ground", name: "Ground", kind: "site", bounds: { width: 500, height: 500 } }],
    map: { levelId: "ground", bounds: { width: 500, height: 500 }, features: [] },
    buildings: [],
    nodes: [],
    edges: [],
    places: [],
    ...overrides,
  };
}

function route(points: [number, number][]): PlannedRoute {
  return {
    nodeIds: points.map((_, i) => `n${i}`),
    points,
    distanceM: 0,
    durationS: 0,
    buildingIds: [],
  };
}

describe("generateSteps", () => {
  it("produces a single depart+arrive pair for a straight line", () => {
    const bundle = makeBundle();
    const steps = generateSteps(bundle, route([[0, 0], [100, 0]]), "Library");
    expect(steps.map((s) => s.maneuver)).toEqual(["depart", "arrive"]);
    expect(steps[0]!.distanceM).toBeCloseTo(100);
    expect(steps[1]!.landmark).toBe("Library");
  });

  it("merges consecutive straight segments into one depart step", () => {
    const bundle = makeBundle();
    const steps = generateSteps(
      bundle,
      route([[0, 0], [50, 0], [100, 5], [150, 0]]),
      "Library",
    );
    // All three interior turn angles are tiny, so it should still be depart -> arrive.
    expect(steps.map((s) => s.maneuver)).toEqual(["depart", "arrive"]);
  });

  it("emits a right-turn step at a 90-degree corner", () => {
    const bundle = makeBundle();
    // Travel east, then turn to travel south (y-down frame => a right turn).
    const steps = generateSteps(bundle, route([[0, 0], [100, 0], [100, 100]]), "Library");
    expect(steps.map((s) => s.maneuver)).toEqual(["depart", "right", "arrive"]);
    expect(steps[1]!.distanceM).toBeCloseTo(100);
  });

  it("emits a left-turn step at a -90-degree corner", () => {
    const bundle = makeBundle();
    // Travel east, then turn to travel north.
    const steps = generateSteps(bundle, route([[0, 100], [100, 100], [100, 0]]), "Library");
    expect(steps.map((s) => s.maneuver)).toEqual(["depart", "left", "arrive"]);
  });

  it("attaches the nearest building as a landmark for a turn", () => {
    const bundle = makeBundle({
      buildings: [
        {
          id: "bldg-a",
          name: "Saqr Library",
          aliases: [],
          floors: [0],
          category: "academic",
          labelAt: [105, 5],
        },
      ],
    });
    const steps = generateSteps(bundle, route([[0, 0], [100, 0], [100, 100]]), "Somewhere Else");
    expect(steps[1]!.landmark).toBe("Saqr Library");
    expect(steps[1]!.detail).toContain("Saqr Library");
  });

  it("handles a start and end that are the same point", () => {
    const bundle = makeBundle();
    const steps = generateSteps(bundle, route([[10, 10]]), "Library");
    expect(steps).toHaveLength(1);
    expect(steps[0]!.maneuver).toBe("arrive");
  });
});
