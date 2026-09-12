import { describe, expect, it } from "vitest";

import {
  area,
  centroidOfPolygon,
  pointInPolygon,
  rotatedRect,
  signedArea,
} from "@/domain/geometry/polygon";
import type { Point } from "@/domain/geometry/vector";

describe("polygon helpers", () => {
  const square: Point[] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it("area of a 10x10 square is 100", () => {
    expect(area(square)).toBe(100);
  });

  it("signedArea sign flips with winding order", () => {
    const reversed = [...square].reverse();
    expect(Math.sign(signedArea(square))).not.toBe(Math.sign(signedArea(reversed)));
  });

  it("centroid of a square is its center", () => {
    const [cx, cy] = centroidOfPolygon(square);
    expect(cx).toBeCloseTo(5, 6);
    expect(cy).toBeCloseTo(5, 6);
  });

  it("pointInPolygon is true inside and false outside", () => {
    expect(pointInPolygon([5, 5], square)).toBe(true);
    expect(pointInPolygon([-1, 5], square)).toBe(false);
    expect(pointInPolygon([15, 5], square)).toBe(false);
  });

  it("rotatedRect at 0 degrees matches an axis-aligned rectangle", () => {
    const corners = rotatedRect([0, 0], 10, 4, 0);
    expect(area(corners)).toBeCloseTo(40, 6);
    // First corner should be top-left-ish: (-5, -2)
    expect(corners[0][0]).toBeCloseTo(-5, 6);
    expect(corners[0][1]).toBeCloseTo(-2, 6);
  });

  it("rotatedRect preserves area under rotation", () => {
    const corners = rotatedRect([3, 7], 8, 6, 37);
    expect(area(corners)).toBeCloseTo(48, 6);
  });
});
