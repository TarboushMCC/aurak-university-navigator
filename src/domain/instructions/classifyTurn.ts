/**
 * Classifies a signed turn angle (from vector.ts's `turnAngleDeg`, positive = right)
 * into a maneuver, per docs/PLAN.md §7.1 step 4.
 */
export type TurnManeuver =
  | "straight"
  | "slight_left"
  | "slight_right"
  | "left"
  | "right"
  | "sharp_left"
  | "sharp_right"
  | "u_turn";

export function classifyTurn(angleDeg: number): TurnManeuver {
  const abs = Math.abs(angleDeg);
  const isRight = angleDeg >= 0;

  if (abs < 25) return "straight";
  if (abs < 60) return isRight ? "slight_right" : "slight_left";
  if (abs < 135) return isRight ? "right" : "left";
  if (abs < 170) return isRight ? "sharp_right" : "sharp_left";
  return "u_turn";
}
