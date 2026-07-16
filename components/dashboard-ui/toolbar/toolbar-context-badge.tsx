import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function ToolbarContextBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      <Info className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      <span>{children}</span>
    </span>
  );
}
