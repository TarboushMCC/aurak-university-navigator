import type { Maneuver } from "@/domain/instructions/generateSteps";

/** Rounds a distance for display: to 5 m under 50 m, to 10 m at/above 50 m (§7.1 step 10). */
export function roundDistanceM(distanceM: number): number {
  const step = distanceM < 50 ? 5 : 10;
  return Math.max(step, Math.round(distanceM / step) * step);
}

const TITLES: Record<Maneuver, string> = {
  depart: "HEAD TOWARD",
  straight: "GO STRAIGHT",
  slight_left: "KEEP LEFT",
  slight_right: "KEEP RIGHT",
  left: "TURN LEFT",
  right: "TURN RIGHT",
  sharp_left: "TURN SHARP LEFT",
  sharp_right: "TURN SHARP RIGHT",
  u_turn: "MAKE A U-TURN",
  arrive: "YOU HAVE ARRIVED",
};

export function stepTitle(maneuver: Maneuver, landmark: string | undefined): string {
  if (maneuver === "depart") return landmark ? `HEAD TOWARD ${landmark.toUpperCase()}` : "HEAD OUT";
  return TITLES[maneuver];
}

export function stepDetail(
  maneuver: Maneuver,
  distanceM: number,
  landmark: string | undefined,
): string {
  const distancePhrase = `about ${roundDistanceM(distanceM)} m`;

  if (maneuver === "arrive") {
    return landmark ? `${landmark} is right here` : "You have arrived";
  }
  if (maneuver === "depart") {
    return `Walk ${distancePhrase}`;
  }
  if (maneuver === "straight") {
    return `Continue ${distancePhrase}`;
  }
  return landmark ? `at ${landmark} · walk ${distancePhrase}` : `Walk ${distancePhrase}`;
}
