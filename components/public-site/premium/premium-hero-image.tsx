"use client";

import { useEffect, useState } from "react";
import { DEFAULT_HERO_IMAGE } from "@/lib/public-site/theme";

type Props = {
  src: string;
  alt: string;
};

export function PremiumHeroImage({ src, alt }: Props) {
  const resolvedSrc = src.trim() || DEFAULT_HERO_IMAGE;
  const [currentSrc, setCurrentSrc] = useState(resolvedSrc);
  const [showGradient, setShowGradient] = useState(false);

  useEffect(() => {
    setCurrentSrc(src.trim() || DEFAULT_HERO_IMAGE);
    setShowGradient(false);
  }, [src]);

  if (showGradient) {
    return (
      <div
        className="flex min-h-[280px] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--site-primary)] to-[var(--site-accent)]"
        role="img"
        aria-label={alt}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      className="block w-full h-auto max-h-[32rem] object-contain"
      onError={() => {
        if (currentSrc !== DEFAULT_HERO_IMAGE) {
          setCurrentSrc(DEFAULT_HERO_IMAGE);
          return;
        }
        setShowGradient(true);
      }}
    />
  );
}
