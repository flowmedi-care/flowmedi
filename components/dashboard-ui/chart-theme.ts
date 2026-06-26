export const CHART_COLORS = {
  primary: "hsl(160 84% 39%)",
  secondary: "hsl(217 91% 60%)",
  tertiary: "hsl(38 92% 50%)",
  quaternary: "hsl(262 83% 58%)",
  muted: "hsl(220 10% 46%)",
} as const;

export const CHART_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.tertiary,
  CHART_COLORS.quaternary,
  CHART_COLORS.muted,
];

export const chartGridProps = {
  strokeDasharray: "3 3",
  stroke: "hsl(var(--border))",
  vertical: false,
} as const;

export const chartAxisProps = {
  tick: { fontSize: 12, fill: "hsl(var(--muted-foreground))" },
  axisLine: false,
  tickLine: false,
} as const;

export const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.75rem",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
    fontSize: "13px",
  },
  labelStyle: {
    color: "hsl(var(--foreground))",
    fontWeight: 600,
    marginBottom: 4,
  },
  itemStyle: {
    color: "hsl(var(--muted-foreground))",
    padding: 0,
  },
} as const;

export const chartLineProps = {
  type: "monotone" as const,
  strokeWidth: 2,
  dot: false,
  activeDot: { r: 4, strokeWidth: 0 },
};

export const chartBarProps = {
  radius: [4, 4, 0, 0] as [number, number, number, number],
};
