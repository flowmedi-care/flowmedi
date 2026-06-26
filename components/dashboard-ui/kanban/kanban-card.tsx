import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KanbanCardShell({
  children,
  className,
  isDragging,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  isDragging?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        "shadow-sm border-border/60 transition-shadow hover:shadow-elevated",
        isDragging && "opacity-60 rotate-1",
        className
      )}
    >
      <CardContent className="p-3 space-y-2" onClick={onClick}>
        {children}
      </CardContent>
    </Card>
  );
}
