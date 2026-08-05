"use client";

import { useEffect, useRef } from "react";

const DEPTHS = [25, 50, 75, 100] as const;

export type ScrollDepth = (typeof DEPTHS)[number];

/**
 * Dispara callback uma vez por marco de scroll (25/50/75/100).
 */
export function useScrollDepth(
  onDepth: (percent: ScrollDepth) => void,
  enabled = true
): void {
  const fired = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const height = doc.scrollHeight - window.innerHeight;
      if (height <= 0) return;
      const percent = Math.min(100, Math.round((scrollTop / height) * 100));

      for (const d of DEPTHS) {
        if (percent >= d && !fired.current.has(d)) {
          fired.current.add(d);
          onDepth(d);
        }
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled, onDepth]);
}
