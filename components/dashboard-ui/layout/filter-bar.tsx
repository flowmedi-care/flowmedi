"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageToolbar } from "@/components/dashboard-ui/page-toolbar";
import { cn } from "@/lib/utils";

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filters,
  actions,
  className,
}: {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <PageToolbar
      className={className}
      filters={
        <>
          {onSearchChange != null && (
            <div className="relative flex-1 w-full min-w-[240px] sm:max-w-2xl">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn(
                  "h-10 w-full pl-10 text-sm bg-background border-border/60 shadow-none",
                  "focus-visible:bg-background focus-visible:ring-1"
                )}
              />
            </div>
          )}
          {filters}
        </>
      }
    >
      {actions}
    </PageToolbar>
  );
}
