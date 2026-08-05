"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useClinicasAnalytics } from "./analytics-provider";

export function useTrackedSection(
  section: "hero" | "flow" | "how_it_works" | "before_after" | "demo" | "faq"
): RefObject<HTMLElement> {
  const { trackSection } = useClinicasAnalytics();
  const ref = useRef<HTMLElement | null>(null);
  const done = useRef(false);
  const onView = useCallback(() => trackSection(section), [trackSection, section]);

  useEffect(() => {
    if (done.current) return;
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
      { threshold: 0.35 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onView]);

  return ref as RefObject<HTMLElement>;
}
