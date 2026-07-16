"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageToolbar } from "@/components/dashboard-ui/toolbar/page-toolbar";
import { FilterGroup } from "@/components/dashboard-ui/filters/filter-group";
import { cn } from "@/lib/utils";

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filters,
  actions,
  meta,
  className,
}: {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <PageToolbar className={className}>
      <PageToolbar.Filters>
        <FilterGroup>
          {onSearchChange != null && (
            <div className="relative flex-1 w-full min-w-[200px] sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn(
                  "h-9 w-full pl-9 text-sm bg-background border-border/60 shadow-none",
                  "focus-visible:bg-background focus-visible:ring-1"
                )}
              />
            </div>
          )}
          {filters}
        </FilterGroup>
      </PageToolbar.Filters>
      {actions != null && <PageToolbar.Actions>{actions}</PageToolbar.Actions>}
      {meta != null && <PageToolbar.Meta>{meta}</PageToolbar.Meta>}
    </PageToolbar>
  );
}
