"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ToolbarFilterButton({
  count = 0,
  onClick,
  className,
  "aria-label": ariaLabel = "Abrir filtros",
}: {
  count?: number;
  onClick: () => void;
  className?: string;
  "aria-label"?: string;
}) {
  const hasFilters = count > 0;

  return (
    <Button
      type="button"
      size="icon"
      variant={hasFilters ? "secondary" : "outline"}
      className={cn(
        "h-10 w-10 rounded-full shadow-none shrink-0",
        hasFilters && "relative",
        className
      )}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <SlidersHorizontal className="h-4 w-4" />
      {hasFilters && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] leading-[18px] text-center px-1 font-semibold">
          {count}
        </span>
      )}
    </Button>
  );
}
