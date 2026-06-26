"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type SegmentedTab = {
  id: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
};

export function SegmentedTabs({
  tabs,
  value,
  onChange,
  variant = "underline",
  className,
}: {
  tabs: SegmentedTab[];
  value: string;
  onChange: (id: string) => void;
  variant?: "underline" | "pill";
  className?: string;
}) {
  if (variant === "pill") {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {tab.label}
              {tab.count != null && (
                <span className={cn("text-xs", active ? "text-primary-foreground/80" : "")}>
                  ({tab.count})
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-0 overflow-x-auto px-4 sm:px-6", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-3 min-h-[44px] text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
            {tab.count != null && ` (${tab.count})`}
          </button>
        );
      })}
    </div>
  );
}
