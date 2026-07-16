export type MonthPeriodValue = { year: number; month: number };

export const PRESET_OPTIONS = [
  { value: "7d", label: "7d", title: "Últimos 7 dias" },
  { value: "30d", label: "30d", title: "Últimos 30 dias" },
  { value: "90d", label: "90d", title: "Últimos 90 dias" },
  { value: "this_month", label: "Este mês", title: "Este mês" },
  { value: "last_month", label: "Anterior", title: "Mês anterior" },
  { value: "custom", label: "Personalizado", title: "Personalizado" },
] as const;

export const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];
