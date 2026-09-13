import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { DirectionArrow } from "@/features/guide/DirectionArrow";
import { RouteOverviewMap } from "@/features/guide/RouteOverviewMap";
import { roundDistanceM } from "@/domain/instructions/phrasing";

import type { Step } from "@/domain/instructions/generateSteps";
import type { PlannedRoute } from "@/domain/routing/planRoute";
import type { MapFeature } from "@/domain/schema";

export interface GuideViewProps {
  steps: Step[];
  stepIndex: number;
  onStepChange: (index: number) => void;
  route: PlannedRoute;
  features: MapFeature[];
  onExit: () => void;
}

const SWIPE_THRESHOLD_PX = 48;

/**
 * Full-screen, one-instruction-per-screen turn-by-turn guide (docs/PLAN.md
 * §8.2): a giant egocentric arrow for "which way do I turn", paired with a
 * stable full-route overview for "where am I in the whole trip" — the two
 * never compete for the same job.
 */
export function GuideView({ steps, stepIndex, onStepChange, route, features, onExit }: GuideViewProps) {
  const reducedMotion = useReducedMotion();
  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const remainingM = steps.slice(stepIndex).reduce((sum, s) => sum + s.distanceM, 0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        if (!isLast) onStepChange(stepIndex + 1);
      } else if (e.key === "ArrowLeft") {
        if (!isFirst) onStepChange(stepIndex - 1);
      } else if (e.key === "Escape") {
        onExit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepIndex, isFirst, isLast, onStepChange, onExit]);

  const touchStartX = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const startX = touchStartX.current;
    touchStartX.current = null;
    const endX = e.changedTouches[0]?.clientX;
    if (startX === null || endX === undefined) return;
    const delta = endX - startX;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta < 0 && !isLast) onStepChange(stepIndex + 1);
    if (delta > 0 && !isFirst) onStepChange(stepIndex - 1);
  }

  // Buttons keep keyboard focus after a click, so the space/enter key they
  // already respond to would otherwise double-fire alongside our own
  // ArrowLeft/ArrowRight handling above.
  function advance(next: number, e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.blur();
    onStepChange(next);
  }

  if (!step) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--color-ground)" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 sm:px-6"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit guide, back to map"
          className="flex h-9 w-9 items-center justify-center rounded-full border text-(--color-ink-muted) transition-colors hover:text-(--color-ink)"
          style={{ borderColor: "var(--color-border)" }}
        >
          <X size={16} strokeWidth={2} />
        </button>
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-(--color-ink-muted)">
            STEP {stepIndex + 1} OF {steps.length}
          </p>
          <div className="flex w-full max-w-64 gap-1">
            {steps.map((s, i) => (
              <span
                key={s.index}
                className="h-1 flex-1 rounded-full transition-colors duration-300"
                style={{
                  background: i <= stepIndex ? "var(--color-accent)" : "var(--color-border)",
                }}
              />
            ))}
          </div>
        </div>
        <p className="w-9 text-right text-[11px] font-medium tabular-nums text-(--color-ink-muted)">
          {remainingM > 0 ? `${roundDistanceM(remainingM)}m` : ""}
        </p>
      </div>

      <div
        aria-live="polite"
        className="flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden px-6 py-4 text-center"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -28 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.22, ease: "easeOut" }}
            className="flex flex-col items-center gap-5"
          >
            <DirectionArrow
              maneuver={step.maneuver}
              size={152}
              className={step.maneuver === "arrive" ? "text-(--color-start)" : "text-(--color-accent)"}
            />
            <div>
              <h2 className="text-[1.75rem] leading-tight font-extrabold tracking-tight text-(--color-ink) sm:text-4xl">
                {step.title}
              </h2>
              <p className="mt-2 text-base text-(--color-ink-muted) sm:text-xl">{step.detail}</p>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="w-full max-w-sm shrink-0">
          <RouteOverviewMap features={features} route={route} step={step} />
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-3 px-4 sm:px-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={(e) => advance(stepIndex - 1, e)}
          disabled={isFirst}
          aria-label="Previous step"
          className="flex min-h-14 flex-1 items-center justify-center gap-1.5 rounded-2xl border text-sm font-semibold text-(--color-ink) transition-opacity disabled:opacity-30"
          style={{ borderColor: "var(--color-border)" }}
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
          PREV
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={onExit}
            className="min-h-14 flex-[1.4] rounded-2xl text-sm font-semibold"
            style={{ background: "var(--color-start)", color: "var(--color-accent-ink)" }}
          >
            DONE
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => advance(stepIndex + 1, e)}
            className="flex min-h-14 flex-[1.4] items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
          >
            NEXT
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
