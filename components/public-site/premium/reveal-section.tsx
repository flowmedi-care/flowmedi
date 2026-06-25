"use client";

import { cn } from "@/lib/utils";
import { useRevealOnScroll } from "./use-reveal-on-scroll";

export function RevealSection({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const { ref, visible } = useRevealOnScroll<HTMLElement>();

  return (
    <section
      id={id}
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out motion-reduce:transition-none",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        className
      )}
    >
      {children}
    </section>
  );
}
