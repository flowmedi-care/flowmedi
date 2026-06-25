"use client";

import { useState } from "react";
import { DEFAULT_HERO_IMAGE } from "@/lib/public-site/theme";

type Props = {
  src: string;
  alt: string;
};

export function PremiumHeroImage({ src, alt }: Props) {
  const [currentSrc, setCurrentSrc] = useState(src);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => {
        if (currentSrc !== DEFAULT_HERO_IMAGE) {
          setCurrentSrc(DEFAULT_HERO_IMAGE);
        }
      }}
    />
  );
}
