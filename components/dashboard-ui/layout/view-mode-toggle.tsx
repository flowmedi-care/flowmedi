"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type ViewModeOption<T extends string> = {
  value: T;
  label?: string;
  icon?: LucideIcon;
  title?: string;
};

export function ViewModeToggle<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ViewModeOption<T>[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-lg bg-muted/60 p-1",
        className
      )}
      role="group"
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.title ?? opt.label}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-all",
              Icon && !opt.label && "w-8 px-0",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {opt.label && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
