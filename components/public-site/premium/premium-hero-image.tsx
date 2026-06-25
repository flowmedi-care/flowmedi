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
        className="absolute inset-0 bg-gradient-to-br from-[var(--site-primary)] to-[var(--site-accent)]"
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
      className="absolute inset-0 h-full w-full object-cover"
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
