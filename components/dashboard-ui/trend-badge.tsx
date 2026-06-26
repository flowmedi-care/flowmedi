import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

export function TrendBadge({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const isPositive = value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Badge
      variant={isPositive ? "trend-up" : "trend-down"}
      className={cn("gap-1 font-medium", className)}
    >
      <Icon className="h-3 w-3" />
      {isPositive ? "+" : ""}
      {value}%
      {label && <span className="font-normal opacity-80">{label}</span>}
    </Badge>
  );
}
