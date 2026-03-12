"use client";

import { useId } from "react";
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
  const gradId = useId();
  const content = (
    <>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        width={iconSize}
        height={iconSize}
        aria-hidden
      >
        <defs>
          <linearGradient
            id={gradId}
            x1="8"
            y1="56"
            x2="56"
            y2="8"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={variant === "light" ? "hsl(0 0% 100%)" : "hsl(var(--primary))"} />
            <stop offset="1" stopColor={variant === "light" ? "hsl(0 0% 88%)" : "hsl(198 88% 45%)"} />
          </linearGradient>
        </defs>

        <rect
          x="4"
          y="4"
          width="56"
          height="56"
          rx="10"
          stroke={`url(#${gradId})`}
          strokeWidth="4"
          fill="none"
        />

        <path
          d="M18 22h4v-4h4v4h4v4h-4v4h-4v-4h-4z"
          stroke={`url(#${gradId})`}
          strokeWidth="3"
          strokeLinejoin="round"
          fill="none"
        />

        <path
          d="M15 36h12l3-6 4 12 4-17 4 13 3-6h8"
          stroke={`url(#${gradId})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        <path
          d="M37 47v7M44 43v11M51 39v15M44 43h7l8-9"
          stroke={`url(#${gradId})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
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
