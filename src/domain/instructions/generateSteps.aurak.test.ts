import { describe, expect, it } from "vitest";

import { generateSteps } from "@/domain/instructions/generateSteps";
import { planRoute } from "@/domain/routing/planRoute";
import { StaticJsonRepository } from "@/data/StaticJsonRepository";

/**
 * Golden sanity checks against the real AURAK campus data (docs/PLAN.md §7.1
 * golden tests): every route between a sample of real place pairs should
 * produce a sensible step sequence — starting with depart, ending with
 * arrive, and covering the route's full distance.
 */
describe("generateSteps against real AURAK data", () => {
  const bundle = new StaticJsonRepository().getBundleSync("aurak");
  // Gate ids are timestamp-based (assigned by whichever graph node the user
  // traced each gate as), so there's no stable "place.gate1" to hardcode —
  // grab whichever gate place the current trace happens to have.
  const gateId = bundle.places.find((p) => p.type === "gate")!.id;

  const pairs: [string, string][] = [
    [gateId, "place.j"],
    [gateId, "place.i"],
    ["place.warehouse", "place.temp"],
    ["place.res-6", "place.h"],
    ["place.parking", "place.mosque"],
  ];

  for (const [fromId, toId] of pairs) {
    it(`routes sensibly from ${fromId} to ${toId}`, () => {
      const fromPlace = bundle.places.find((p) => p.id === fromId);
      const toPlace = bundle.places.find((p) => p.id === toId);
      expect(fromPlace).toBeDefined();
      expect(toPlace).toBeDefined();
      if (!fromPlace || !toPlace) return;
      const route = planRoute(bundle, fromId, toId);
      expect(route).not.toBeNull();
      if (!route) return;

      const steps = generateSteps(bundle, route, toPlace.name);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0]!.maneuver).toBe("depart");
      expect(steps.at(-1)!.maneuver).toBe("arrive");

      const totalStepDistance = steps.reduce((sum, s) => sum + s.distanceM, 0);
      expect(totalStepDistance).toBeCloseTo(route.distanceM, 0);

      for (const step of steps) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.detail.length).toBeGreaterThan(0);
      }
    });
  }

  it("produces a working route for every startable place pair sample (no crashes)", () => {
    const startable = bundle.places.filter((p) => p.startable && p.anchors.length > 0);
    const sample = startable.slice(0, 6);
    for (const from of sample) {
      for (const to of sample) {
        if (from.id === to.id) continue;
        const route = planRoute(bundle, from.id, to.id);
        if (!route) continue;
        expect(() => generateSteps(bundle, route, to.name)).not.toThrow();
      }
    }
  });
});
