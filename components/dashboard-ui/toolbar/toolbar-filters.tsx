import { cn } from "@/lib/utils";

export function ToolbarFilters({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-1 min-w-0", className)}>{children}</div>;
}

ToolbarFilters.displayName = "PageToolbar.Filters";
