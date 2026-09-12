import { describe, expect, it } from "vitest";

import { applyH, invertH, solveHomography } from "@/domain/geometry/homography";
import type { Point } from "@/domain/geometry/vector";

describe("solveHomography", () => {
  it("recovers an exact affine mapping (identity scale) from 4 points", () => {
    const points = [
      { image: [0, 0] as Point, map: [0, 0] as Point },
      { image: [100, 0] as Point, map: [10, 0] as Point },
      { image: [100, 50] as Point, map: [10, 5] as Point },
      { image: [0, 50] as Point, map: [0, 5] as Point },
    ];
    const h = solveHomography(points);
    for (const p of points) {
      const result = applyH(h, p.image);
      expect(result[0]).toBeCloseTo(p.map[0], 6);
      expect(result[1]).toBeCloseTo(p.map[1], 6);
    }
  });

  it("recovers a true perspective warp applied to a known square", () => {
    // A synthetic projective transform: image (unit square corners moved to
    // a trapezoid) -> map (a true 10x10 square). This is not affine.
    const trapezoid: Point[] = [
      [100, 400], // maps to (0, 0)     - bottom-left, wide
      [500, 420], // maps to (10, 0)    - bottom-right, wide
      [420, 100], // maps to (10, 10)   - top-right, narrow
      [180, 100], // maps to (0, 10)    - top-left, narrow
    ];
    const square: Point[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    const h = solveHomography(
      trapezoid.map((image, i) => ({ image, map: square[i]! })),
    );
    for (let i = 0; i < 4; i++) {
      const result = applyH(h, trapezoid[i]!);
      expect(result[0]).toBeCloseTo(square[i]![0], 4);
      expect(result[1]).toBeCloseTo(square[i]![1], 4);
    }
  });

  it("least-squares fits when given more than 4 (slightly noisy) points", () => {
    const base = [
      { image: [0, 0] as Point, map: [0, 0] as Point },
      { image: [100, 0] as Point, map: [50, 0] as Point },
      { image: [100, 100] as Point, map: [50, 50] as Point },
      { image: [0, 100] as Point, map: [0, 50] as Point },
      { image: [50, 50] as Point, map: [25.2, 24.8] as Point }, // slightly noisy
    ];
    const h = solveHomography(base);
    // Should still land close to the noiseless corners.
    const result = applyH(h, [0, 0]);
    expect(result[0]).toBeCloseTo(0, 0);
    expect(result[1]).toBeCloseTo(0, 0);
  });

  it("throws with fewer than 4 points", () => {
    expect(() =>
      solveHomography([
        { image: [0, 0], map: [0, 0] },
        { image: [1, 0], map: [1, 0] },
        { image: [1, 1], map: [1, 1] },
      ]),
    ).toThrow();
  });
});

describe("invertH", () => {
  it("round-trips applyH(invertH(H), applyH(H, p)) === p", () => {
    const points = [
      { image: [0, 0] as Point, map: [0, 0] as Point },
      { image: [100, 20] as Point, map: [40, 5] as Point },
      { image: [90, 100] as Point, map: [38, 42] as Point },
      { image: [10, 90] as Point, map: [2, 39] as Point },
    ];
    const h = solveHomography(points);
    const hInv = invertH(h);
    for (const p of [
      [50, 50],
      [0, 0],
      [100, 100],
    ] as Point[]) {
      const mapped = applyH(h, p);
      const back = applyH(hInv, mapped);
      expect(back[0]).toBeCloseTo(p[0], 3);
      expect(back[1]).toBeCloseTo(p[1], 3);
    }
  });
});
