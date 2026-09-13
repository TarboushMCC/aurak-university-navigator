import { motion, useReducedMotion } from "motion/react";

import type { Maneuver } from "@/domain/instructions/generateSteps";

const ROTATION_DEG: Partial<Record<Maneuver, number>> = {
  straight: 0,
  slight_right: 45,
  right: 90,
  sharp_right: 135,
  slight_left: -45,
  left: -90,
  sharp_left: -135,
};

export interface DirectionArrowProps {
  maneuver: Maneuver;
  size?: number;
  className?: string;
}

/**
 * One SVG glyph for every maneuver (docs/PLAN.md §8.3). Straight/turn
 * maneuvers share a single arrow shape that rotates with a spring; special
 * maneuvers (u-turn, depart, arrive) swap in their own glyph entirely.
 */
export function DirectionArrow({ maneuver, size = 160, className }: DirectionArrowProps) {
  const reducedMotion = useReducedMotion();
  const rotation = ROTATION_DEG[maneuver] ?? 0;

  if (maneuver === "u_turn") {
    return (
      <span
        role="img"
        aria-label="Make a U-turn"
        className={className}
        style={{ display: "inline-flex", width: size, height: size }}
      >
        <UTurnGlyph size={size} />
      </span>
    );
  }

  if (maneuver === "depart") {
    return (
      <span
        role="img"
        aria-label="Head toward"
        className={className}
        style={{ display: "inline-flex", width: size, height: size }}
      >
        <DepartGlyph size={size} />
      </span>
    );
  }

  if (maneuver === "arrive") {
    return (
      <span
        role="img"
        aria-label="You have arrived"
        className={className}
        style={{ display: "inline-flex", width: size, height: size }}
      >
        <ArriveGlyph size={size} />
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={maneuver.replace(/_/g, " ")}
      className={className}
      style={{ display: "inline-flex", width: size, height: size }}
    >
      <motion.svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        animate={{ rotate: rotation }}
        initial={false}
        transition={
          reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 18 }
        }
      >
        <ArrowGlyph reducedMotion={Boolean(reducedMotion)} />
      </motion.svg>
    </span>
  );
}

function ArrowGlyph({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <g fill="currentColor">
      <path d="M50 8 L82 46 L62 46 L62 92 L38 92 L38 46 L18 46 Z" />
      {!reducedMotion && (
        <motion.path
          d="M50 8 L82 46 L62 46 L62 92 L38 92 L38 46 L18 46 Z"
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={2}
          initial={{ y: 0 }}
          animate={{ y: [-4, 0, -4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </g>
  );
}

function UTurnGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none">
      <path
        d="M35 80 V45 a20 20 0 0 1 40 0 v20"
        stroke="currentColor"
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path d="M62 55 L88 68 L62 82 Z" fill="currentColor" />
    </svg>
  );
}

function DepartGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none">
      <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth={3} strokeOpacity={0.35} />
      <path d="M50 15 L74 48 L58 48 L58 85 L42 85 L42 48 L26 48 Z" fill="currentColor" />
    </svg>
  );
}

function ArriveGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none">
      <circle cx="50" cy="55" r="34" stroke="currentColor" strokeWidth={2.5} strokeOpacity={0.25} />
      <circle cx="50" cy="55" r="20" stroke="currentColor" strokeWidth={2.5} strokeOpacity={0.4} />
      <path
        d="M50 22 C36 22 27 33 27 46 C27 65 50 84 50 84 C50 84 73 65 73 46 C73 33 64 22 50 22 Z"
        fill="currentColor"
      />
      <circle cx="50" cy="45" r="9" fill="var(--color-surface)" />
    </svg>
  );
}
