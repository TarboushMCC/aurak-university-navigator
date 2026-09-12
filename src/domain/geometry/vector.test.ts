import { describe, expect, it } from "vitest";

import {
  bbox,
  cross,
  distance,
  dot,
  polylineLength,
  turnAngleDeg,
} from "@/domain/geometry/vector";
import type { Point } from "@/domain/geometry/vector";

describe("vector helpers", () => {
  it("distance computes Euclidean distance", () => {
    expect(distance([0, 0], [3, 4])).toBe(5);
  });

  it("dot and cross match hand-computed values", () => {
    const a: Point = [1, 0];
    const b: Point = [0, 1];
    expect(dot(a, b)).toBe(0);
    expect(cross(a, b)).toBe(1);
  });

  it("bbox covers all points", () => {
    const [minX, minY, maxX, maxY] = bbox([
      [1, 5],
      [-2, 3],
      [4, -1],
    ]);
    expect([minX, minY, maxX, maxY]).toEqual([-2, -1, 4, 5]);
  });

  it("polylineLength sums segment lengths", () => {
    expect(polylineLength([[0, 0], [3, 0], [3, 4]])).toBe(7);
  });
});

describe("turnAngleDeg (y-down frame, positive = right)", () => {
  it("returns ~0 for continuing straight", () => {
    expect(turnAngleDeg([1, 0], [1, 0])).toBeCloseTo(0, 5);
  });

  it("returns +90 for a right turn (heading east, then south)", () => {
    // In a y-down frame, "south" (downward on screen) is +y.
    expect(turnAngleDeg([1, 0], [0, 1])).toBeCloseTo(90, 5);
  });

  it("returns -90 for a left turn (heading east, then north)", () => {
    expect(turnAngleDeg([1, 0], [0, -1])).toBeCloseTo(-90, 5);
  });

  it("returns ~180 for a u-turn", () => {
    expect(Math.abs(turnAngleDeg([1, 0], [-1, 0]))).toBeCloseTo(180, 5);
  });
});
