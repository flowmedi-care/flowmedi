"use client";

import type { LucideIcon } from "lucide-react";
import { SegmentedControl } from "@/components/dashboard-ui/filters/segmented-control";
import { cn } from "@/lib/utils";

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
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as T)}
      className={className}
      aria-label="Modo de visualização"
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <SegmentedControl.Item
            key={opt.value}
            value={opt.value}
            title={opt.title ?? opt.label}
            className={cn(Icon && !opt.label && "w-8 px-0")}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {opt.label && <span>{opt.label}</span>}
          </SegmentedControl.Item>
        );
      })}
    </SegmentedControl>
  );
}
