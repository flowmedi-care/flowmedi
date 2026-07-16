import { cn } from "@/lib/utils";

export function ToolbarActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 shrink-0 sm:justify-end",
        "pt-3 border-t border-border/40 sm:border-0 sm:pt-0",
        className
      )}
    >
      {children}
    </div>
  );
}

ToolbarActions.displayName = "PageToolbar.Actions";
