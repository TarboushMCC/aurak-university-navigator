import { useGesture } from "@use-gesture/react";
import { animate, useMotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface CameraState {
  /** Map-metre point currently centred in the viewport. */
  cx: number;
  cy: number;
  /** Screen pixels per map metre. */
  scale: number;
  /** Degrees, clockwise. Heading-up rotation used in Guide View (Phase 2). */
  rotationDeg: number;
}

export interface FitBoundsOptions {
  /** Fraction of the viewport to leave as padding on each side (0-0.4). */
  padding?: number;
  rotationDeg?: number;
  /** Animation duration in ms. 0 = instant (used for prefers-reduced-motion). */
  durationMs?: number;
  /** Don't zoom in past this many px/metre even if the bounds are tiny. */
  maxScale?: number;
}

const MIN_SCALE = 0.15;
const MAX_SCALE = 6;

function clampScale(s: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/**
 * Owns the map camera (pan/zoom/rotate) as Motion springs, driven by
 * @use-gesture/react for drag/wheel/pinch. Exposes `fitBounds`/`flyTo` for
 * camera choreography (docs/PLAN.md §4.4).
 */
export function useMapCamera(
  containerRef: React.RefObject<HTMLElement | null>,
  initial: CameraState,
) {
  const cx = useMotionValue(initial.cx);
  const cy = useMotionValue(initial.cy);
  const scale = useMotionValue(initial.scale);
  const rotationDeg = useMotionValue(initial.rotationDeg);

  // Re-rendered copy for consumers that need plain numbers (e.g. computing
  // screen-space label sizes). Motion values alone don't trigger re-renders.
  const [snapshot, setSnapshot] = useState<CameraState>(initial);
  useEffect(() => {
    const update = () =>
      setSnapshot({
        cx: cx.get(),
        cy: cy.get(),
        scale: scale.get(),
        rotationDeg: rotationDeg.get(),
      });
    const unsubs = [cx.on("change", update), cy.on("change", update), scale.on("change", update), rotationDeg.on("change", update)];
    return () => unsubs.forEach((u) => u());
  }, [cx, cy, scale, rotationDeg]);

  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  const flyTo = useCallback(
    (target: Partial<CameraState>, durationMs = 700) => {
      const duration = reducedMotion.current ? 0 : durationMs / 1000;
      if (target.cx !== undefined) animate(cx, target.cx, { duration, ease: "easeInOut" });
      if (target.cy !== undefined) animate(cy, target.cy, { duration, ease: "easeInOut" });
      if (target.scale !== undefined)
        animate(scale, clampScale(target.scale), { duration, ease: "easeInOut" });
      if (target.rotationDeg !== undefined)
        animate(rotationDeg, target.rotationDeg, { duration, ease: "easeInOut" });
    },
    [cx, cy, scale, rotationDeg],
  );

  const fitBounds = useCallback(
    (bbox: [number, number, number, number], opts: FitBoundsOptions = {}) => {
      const el = containerRef.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const padding = opts.padding ?? 0.1;
      const [minX, minY, maxX, maxY] = bbox;
      // A 90°/270° rotation swaps which of the box's dimensions lines up
      // with the container's width vs height on screen, so the scale that
      // fits must be computed against the swapped box, not the raw one.
      const rotated = Math.abs(((opts.rotationDeg ?? 0) / 90) % 2) === 1;
      const boxW = Math.max(1, rotated ? maxY - minY : maxX - minX);
      const boxH = Math.max(1, rotated ? maxX - minX : maxY - minY);
      const availW = width * (1 - padding * 2);
      const availH = height * (1 - padding * 2);
      let nextScale = Math.min(availW / boxW, availH / boxH);
      if (opts.maxScale) nextScale = Math.min(nextScale, opts.maxScale);
      flyTo(
        {
          cx: (minX + maxX) / 2,
          cy: (minY + maxY) / 2,
          scale: clampScale(nextScale),
          rotationDeg: opts.rotationDeg ?? 0,
        },
        opts.durationMs ?? 700,
      );
    },
    [containerRef, flyTo],
  );

  // --- Gestures ---------------------------------------------------------
  // Bound directly to `containerRef` (via `target` in the config below), so
  // there is nothing to spread onto the JSX element.

  useGesturesOnCamera(containerRef, cx, cy, scale, rotationDeg);

  return { cx, cy, scale, rotationDeg, snapshot, fitBounds, flyTo };
}

function useGesturesOnCamera(
  containerRef: React.RefObject<HTMLElement | null>,
  cx: ReturnType<typeof useMotionValue<number>>,
  cy: ReturnType<typeof useMotionValue<number>>,
  scale: ReturnType<typeof useMotionValue<number>>,
  rotationDeg: ReturnType<typeof useMotionValue<number>>,
) {
  const pinchStartScale = useRef(1);
  const pinchStartDistance = useRef(1);

  // Screen-space vectors need to be rotated back into map space before
  // they can be applied to cx/cy, otherwise dragging/zooming only works
  // correctly when rotationDeg is 0 (e.g. every axis gets scrambled once
  // the mobile auto-rotate in CampusMap kicks in — panning "only goes
  // down" because a vertical drag was being applied to the map's
  // horizontal axis instead).
  const toMapVector = useCallback(
    (sx: number, sy: number) => {
      const rad = (rotationDeg.get() * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      // Inverse of the screen-space rotation applied by the <g rotate(...)>
      // transform in CampusMap (rotate by rotationDeg around the centre).
      return { x: sx * cos + sy * sin, y: -sx * sin + sy * cos };
    },
    [rotationDeg],
  );

  // Zooms by `factor`, keeping the map-space point under (clientX, clientY)
  // fixed on screen — otherwise the content visibly slides out from under
  // the cursor on every scroll/pinch, which reads as "the map does its own
  // thing" even though the math was technically zooming.
  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const sx = clientX - rect.left - rect.width / 2;
      const sy = clientY - rect.top - rect.height / 2;
      const { x: mvx, y: mvy } = toMapVector(sx, sy);
      const s = scale.get();
      const newScale = clampScale(s * factor);
      const mapX = cx.get() + mvx / s;
      const mapY = cy.get() + mvy / s;
      cx.set(mapX - mvx / newScale);
      cy.set(mapY - mvy / newScale);
      scale.set(newScale);
    },
    [containerRef, cx, cy, scale, toMapVector],
  );

  useGesture(
    {
      // `delta` is this frame's own tiny movement only — never a cumulative
      // distance from some earlier anchor — so there's no stale state that
      // can go wrong across gesture transitions. That matters because a
      // fixed "anchor at gesture start" + cumulative `movement` (the more
      // obvious approach, used here previously) breaks specifically when a
      // two-finger pinch collapses to one finger still touching: dragging
      // is suppressed for the finger that was part of the pinch the whole
      // time (via the `pinching` guard below), but @use-gesture keeps
      // accumulating that finger's `movement` from its very first touch-
      // down regardless — so the instant `pinching` flips false, the next
      // onDrag delivers the *entire* pinch's worth of travel as one sudden
      // jump. Per-frame `delta` has no such backlog to dump.
      onDrag: ({ delta: [dx, dy], pinching, tap }) => {
        if (pinching || tap) return;
        const s = scale.get();
        const { x: mvx, y: mvy } = toMapVector(dx, dy);
        cx.set(cx.get() - mvx / s);
        cy.set(cy.get() - mvy / s);
      },
      onWheel: ({ delta: [, dy], event }) => {
        event.preventDefault();
        const factor = Math.exp(-dy * 0.0015);
        zoomAt(event.clientX, event.clientY, factor);
      },
      // `offset` (like drag's) accumulates across every pinch the user has
      // ever made on this camera rather than resetting per-gesture, so
      // reusing it here caused the exact same class of bug as the drag one
      // above: the second (and every later) pinch started from whatever
      // scale ratio the previous pinch had left `offset` sitting at, not
      // from 1, producing a jump the instant two fingers touched down and
      // increasingly wrong zooming after. `da[0]` (the raw current
      // finger-to-finger distance in pixels) has no such memory — it's
      // just the physical distance this instant — so anchor a fresh ratio
      // to it at the start of each gesture instead.
      onPinchStart: ({ da: [d] }) => {
        pinchStartScale.current = scale.get();
        pinchStartDistance.current = d || 1;
      },
      onPinch: ({ da: [d], origin: [ox, oy] }) => {
        const targetScale = pinchStartScale.current * (d / pinchStartDistance.current);
        zoomAt(ox, oy, targetScale / scale.get());
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      drag: { filterTaps: true },
      wheel: { eventOptions: { passive: false } },
    },
  );
}
