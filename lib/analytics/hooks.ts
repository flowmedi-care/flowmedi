"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Dispara callback uma vez quando o elemento entra no viewport.
 */
export function useSectionViewed(
  onView: () => void,
  options?: IntersectionObserverInit & { enabled?: boolean }
): RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null);
  const done = useRef(false);
  const enabled = options?.enabled ?? true;
  const threshold = options?.threshold ?? 0.35;
  const rootMargin = options?.rootMargin;

  useEffect(() => {
    if (!enabled || done.current) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !done.current) {
          done.current = true;
          onView();
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, onView, threshold, rootMargin]);

  return ref;
}
