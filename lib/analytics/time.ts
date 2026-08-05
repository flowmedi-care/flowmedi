"use client";

import { useEffect, useRef } from "react";

const MILESTONES = [30, 60, 90, 120] as const;

export type TimeMilestone = (typeof MILESTONES)[number];

/**
 * Dispara callback uma vez por marco de tempo na página (segundos).
 */
export function useTimeOnPage(
  onMilestone: (seconds: TimeMilestone) => void,
  enabled = true
): void {
  const fired = useRef<Set<number>>(new Set());
  const started = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    started.current = Date.now();

    const tick = () => {
      const elapsed = Math.floor((Date.now() - started.current) / 1000);
      for (const s of MILESTONES) {
        if (elapsed >= s && !fired.current.has(s)) {
          fired.current.add(s);
          onMilestone(s);
        }
      }
    };

    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [enabled, onMilestone]);
}

export function getElapsedSeconds(startedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}
