import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SiteSection({
  id,
  children,
  className,
  tinted,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tinted?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn("py-20 sm:py-24 px-4 sm:px-6", tinted && "bg-[#f7faf9]", className)}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function SiteSectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "mb-12 sm:mb-14 max-w-2xl",
        align === "center" && "mx-auto text-center"
      )}
    >
      {eyebrow && (
        <p className="text-sm font-medium text-primary tracking-wide mb-2">{eyebrow}</p>
      )}
      <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1a2e28] leading-tight">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-base sm:text-lg text-[#5c6f68] leading-relaxed">{description}</p>
      )}
    </div>
  );
}
