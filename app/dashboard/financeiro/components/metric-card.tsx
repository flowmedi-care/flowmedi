// FINANCEIRO FASE 1 — ITEM 1: card de métrica

import { StatCard, type StatCardIconColor } from "@/components/dashboard-ui/stat-card";

export function MetricCard({
  title,
  subtitle,
  value,
  lens,
  variant = "default",
}: {
  title: string;
  subtitle?: string;
  value: string;
  lens?: string;
  variant?: "default" | "positive" | "negative" | "warning";
}) {
  const iconColor: StatCardIconColor =
    variant === "positive"
      ? "success"
      : variant === "negative"
        ? "destructive"
        : variant === "warning"
          ? "warning"
          : "primary";

  return (
    <StatCard
      title={title}
      value={value}
      subtitle={subtitle ?? (lens ? `Perspectiva: ${lens}` : undefined)}
      iconColor={iconColor}
    />
  );
}
