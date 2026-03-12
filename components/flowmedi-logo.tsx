"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface FlowmediLogoProps {
  className?: string;
  href?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  /** Use on dark/primary backgrounds for light logo */
  variant?: "default" | "light";
}

const sizes = {
  sm: { icon: 28, text: "text-lg" },
  md: { icon: 36, text: "text-xl" },
  lg: { icon: 44, text: "text-2xl" },
};

export function FlowmediLogo({
  className,
  href = "/",
  showText = true,
  size = "md",
  variant = "default",
}: FlowmediLogoProps) {
  const { icon: iconSize, text: textClass } = sizes[size];
  const [hasImageError, setHasImageError] = useState(false);
  const brandIconSrc = "/brand/flowmedi-icon.svg?v=20260311";
  const content = (
    <>
      {!hasImageError ? (
        <img
          src={brandIconSrc}
          alt="FlowMedi"
          width={iconSize}
          height={iconSize}
          className="shrink-0 object-contain"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
          width={iconSize}
          height={iconSize}
          aria-hidden
        >
          <path
            d="M5 20h4l2-6 2 6 2-8 2 6 2-4 2 4h4"
            stroke={variant === "light" ? "hsl(0 0% 100%)" : "hsl(var(--primary))"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {showText && (
        <span
          className={cn(
            "font-semibold tracking-tight",
            variant === "light" ? "text-white" : "text-foreground",
            textClass
          )}
        >
          FlowMedi
        </span>
      )}
    </>
  );

  const wrapperClass = cn(
    "inline-flex items-center gap-2.5",
    href && "hover:opacity-90 transition-opacity",
    className
  );

  if (href) {
    return (
      <Link href={href} className={wrapperClass} aria-label="FlowMedi - Início">
        {content}
      </Link>
    );
  }

  return <span className={wrapperClass}>{content}</span>;
}
