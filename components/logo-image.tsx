"use client";

import { useState } from "react";

export function LogoImage({
  src,
  alt,
  className,
  scale = 100,
}: {
  src: string | null;
  alt: string;
  className?: string;
  scale?: number;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return null;
  }

  // Garantir que scale está entre 50 e 200
  const safeScale = Math.max(50, Math.min(200, scale));

  return (
    <div 
      className="inline-block" 
      style={{ 
        transform: `scale(${safeScale / 100})`, 
        transformOrigin: 'center'
      }}
    >
      <img
        src={src}
        alt={alt}
        className={className}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
