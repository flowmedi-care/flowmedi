import { cn } from "@/lib/utils";

export function ToolbarMeta({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-xs text-muted-foreground pt-2 border-t border-border/40", className)}>
      {children}
    </div>
  );
}

ToolbarMeta.displayName = "PageToolbar.Meta";
