import type { Point } from "@/domain/geometry/vector";

/**
 * Homography (3x3 projective transform), row-major, with h[2][2] normalised to 1:
 *   [h00 h01 h02]
 *   [h10 h11 h12]
 *   [h20 h21 1  ]
 *
 * Maps an image pixel (x, y) to a map-metre point (X, Y):
 *   w = h20*x + h21*y + 1
 *   X = (h00*x + h01*y + h02) / w
 *   Y = (h10*x + h11*y + h12) / w
 *
 * Used ONLY in the dev editor to warp the reference picture underlay for
 * tracing (docs/PLAN.md §4.2). Nothing at runtime for end users depends on it.
 */
export type Homography = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

export interface ControlPoint {
  /** Reference-picture pixel coordinates. */
  image: Point;
  /** Target map-metre coordinates. */
  map: Point;
  label?: string;
}

/** Solves an n x n linear system `Ax = b` via Gaussian elimination with partial pivoting. */
function solveLinearSystem(aIn: number[][], bIn: number[]): number[] {
  const n = bIn.length;
  const a = aIn.map((row) => [...row]);
  const b = [...bIn];

  for (let col = 0; col < n; col++) {
    // Partial pivot.
    let pivotRow = col;
    let maxAbs = Math.abs(a[col]![col]!);
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(a[row]![col]!);
      if (v > maxAbs) {
        maxAbs = v;
        pivotRow = row;
      }
    }
    if (maxAbs < 1e-12) {
      throw new Error("solveLinearSystem: matrix is singular or near-singular");
    }
    if (pivotRow !== col) {
      [a[col], a[pivotRow]] = [a[pivotRow]!, a[col]!];
      [b[col], b[pivotRow]] = [b[pivotRow]!, b[col]!];
    }

    const pivot = a[col]![col]!;
    for (let row = col + 1; row < n; row++) {
      const factor = a[row]![col]! / pivot;
      if (factor === 0) continue;
      for (let k = col; k < n; k++) {
        a[row]![k]! -= factor * a[col]![k]!;
      }
      b[row]! -= factor * b[col]!;
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row]!;
    for (let col = row + 1; col < n; col++) {
      sum -= a[row]![col]! * x[col]!;
    }
    x[row] = sum / a[row]![row]!;
  }
  return x;
}

/**
 * Solves for the homography mapping `image -> map` using the Direct Linear
 * Transform. Exactly 4 points give an exact solve; more points are fit by
 * least squares (normal equations). Requires >= 4 non-collinear points.
 */
export function solveHomography(points: readonly ControlPoint[]): Homography {
  if (points.length < 4) {
    throw new Error(`solveHomography: need >= 4 control points, got ${points.length}`);
  }

  // Build the 2n x 8 design matrix `A` and target vector `b` for unknowns
  // [h00, h01, h02, h10, h11, h12, h20, h21] (h22 fixed at 1).
  const rows: number[][] = [];
  const targets: number[] = [];
  for (const { image, map } of points) {
    const [x, y] = image;
    const [X, Y] = map;
    rows.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    targets.push(X);
    rows.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    targets.push(Y);
  }

  // Normal equations: (A^T A) h = A^T b
  const ata: number[][] = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const atb: number[] = new Array<number>(8).fill(0);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    const t = targets[r]!;
    for (let i = 0; i < 8; i++) {
      atb[i]! += row[i]! * t;
      for (let j = 0; j < 8; j++) {
        ata[i]![j]! += row[i]! * row[j]!;
      }
    }
  }

  const h = solveLinearSystem(ata, atb);
  return [
    [h[0]!, h[1]!, h[2]!],
    [h[3]!, h[4]!, h[5]!],
    [h[6]!, h[7]!, 1],
  ];
}

export function applyH(h: Homography, point: Point): Point {
  const [x, y] = point;
  const w = h[2][0] * x + h[2][1] * y + h[2][2];
  const X = (h[0][0] * x + h[0][1] * y + h[0][2]) / w;
  const Y = (h[1][0] * x + h[1][1] * y + h[1][2]) / w;
  return [X, Y];
}

/** Inverts a 3x3 homography so it maps map-metres back to image pixels. */
export function invertH(h: Homography): Homography {
  const a = h[0][0];
  const b = h[0][1];
  const c = h[0][2];
  const d = h[1][0];
  const e = h[1][1];
  const f = h[1][2];
  const g = h[2][0];
  const i = h[2][1];
  const j = h[2][2];

  const det = a * (e * j - f * i) - b * (d * j - f * g) + c * (d * i - e * g);
  if (Math.abs(det) < 1e-12) {
    throw new Error("invertH: matrix is singular");
  }
  const invDet = 1 / det;

  const m00 = (e * j - f * i) * invDet;
  const m01 = (c * i - b * j) * invDet;
  const m02 = (b * f - c * e) * invDet;
  const m10 = (f * g - d * j) * invDet;
  const m11 = (a * j - c * g) * invDet;
  const m12 = (c * d - a * f) * invDet;
  const m20 = (d * i - e * g) * invDet;
  const m21 = (b * g - a * i) * invDet;
  const m22 = (a * e - b * d) * invDet;

  // Renormalise so the bottom-right entry is 1, matching our Homography convention.
  const scale = 1 / m22;
  return [
    [m00 * scale, m01 * scale, m02 * scale],
    [m10 * scale, m11 * scale, m12 * scale],
    [m20 * scale, m21 * scale, 1],
  ];
}

/**
 * Formats a homography as a CSS `matrix3d(...)` transform string for warping
 * the reference-picture `<img>` underlay in the editor (PLAN §4.2). CSS's
 * matrix3d expects a column-major 4x4 matrix; we embed our 2D projective
 * transform in the z=0 plane.
 */
export function toCssMatrix3d(h: Homography): string {
  // Column-major 4x4, with row/col 3 (z) left as identity.
  const m = [
    h[0][0], h[1][0], 0, h[2][0],
    h[0][1], h[1][1], 0, h[2][1],
    0, 0, 1, 0,
    h[0][2], h[1][2], 0, h[2][2],
  ];
  return `matrix3d(${m.join(", ")})`;
}
