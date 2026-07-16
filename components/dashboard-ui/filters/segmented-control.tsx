"use client";

import {
  createContext,
  useContext,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type SegmentedControlContextValue = {
  value: string;
  onChange: (value: string) => void;
  size: "sm" | "md";
};

const SegmentedControlContext = createContext<SegmentedControlContextValue | null>(null);

function useSegmentedControl() {
  const ctx = useContext(SegmentedControlContext);
  if (!ctx) {
    throw new Error("SegmentedControl.Item must be used within SegmentedControl");
  }
  return ctx;
}

export function SegmentedControl({
  value,
  onChange,
  children,
  className,
  size = "md",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  return (
    <SegmentedControlContext.Provider value={{ value, onChange, size }}>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={cn(
          "inline-flex max-w-full items-center gap-0.5 rounded-lg bg-muted/60 p-1",
          size === "sm" ? "min-h-8" : "min-h-9",
          className
        )}
      >
        {children}
      </div>
    </SegmentedControlContext.Provider>
  );
}

function SegmentedControlItem({
  value,
  children,
  className,
  title,
  ...props
}: {
  value: string;
  children: ReactNode;
  className?: string;
  title?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onClick" | "type">) {
  const { value: selected, onChange, size } = useSegmentedControl();
  const active = selected === value;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      title={title}
      onClick={() => onChange(value)}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all whitespace-nowrap",
        size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-sm",
        active
          ? "bg-background text-foreground ring-1 ring-border/60 shadow-none"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

SegmentedControl.Item = SegmentedControlItem;
