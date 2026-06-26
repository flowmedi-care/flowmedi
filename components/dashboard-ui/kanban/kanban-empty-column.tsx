import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function KanbanEmptyColumn({
  message = "Arraste itens aqui",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-border/40 bg-card/50 px-3 py-8 text-center",
        className
      )}
    >
      <Inbox className="h-5 w-5 text-muted-foreground/60 mb-2" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
