import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import type { LucideIcon } from "lucide-react";

export function ListPanel({
  children,
  className,
  empty,
}: {
  children: React.ReactNode;
  className?: string;
  empty?: {
    icon?: LucideIcon;
    title: string;
    description?: string;
  };
}) {
  if (empty) {
    return <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />;
  }

  return (
    <div className={cn("divide-y divide-border/60", className)}>
      {children}
    </div>
  );
}

export function ListPanelItem({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-muted/30 first:pt-0",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </Comp>
  );
}
