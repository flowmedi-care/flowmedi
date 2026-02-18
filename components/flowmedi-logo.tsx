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
  const { icon: iconSize, text: textClass } = sizes;
  const gradId = useId();
  const content = (
    <>
      <svg
        viewBox="0 0 40 40"
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
            x1="0"
            y1="0"
            x2="40"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={variant === "light" ? "hsl(0 0% 100%)" : "hsl(var(--primary))"} />
            <stop offset="1" stopColor={variant === "light" ? "hsl(0 0% 90%)" : "hsl(160 84% 30%)"} />
          </linearGradient>
        </defs>
        {/* Rounded container */}
        <rect
          x="2"
          y="2"
          width="36"
          height="36"
          rx="10"
          fill={variant === "light" ? "rgba(255,255,255,0.15)" : "hsl(var(--primary) / 0.12)"}
        />
        {/* Heartbeat / EKG wave - medical + flow */}
        <path
          d="M8 26 L12 26 L14 20 L16 26 L18 18 L20 26 L24 26 L26 22 L28 26 L30 20 L32 26 L34 26"
          stroke={`url(#${gradId})`}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Small pulse dot */}
        <circle cx="8" cy="26" r="1.5" fill={`url(#${gradId})`} />
        <circle cx="34" cy="26" r="1.5" fill={`url(#${gradId})`} />
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
