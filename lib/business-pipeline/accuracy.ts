import type { ForecastAccuracy } from "./types";

const MIN_ACCURACY_SAMPLE = 50;

/** Precisão da previsão vs faturado real. null se base insuficiente. */
export function computeForecastAccuracy(
  previsto: number,
  realizado: number,
  sampleSize: number
): ForecastAccuracy {
  if (sampleSize < MIN_ACCURACY_SAMPLE) return null;
  const denom = Math.max(previsto, realizado, 1);
  const pct = (1 - Math.abs(previsto - realizado) / denom) * 100;
  return { pct: Math.max(0, Math.min(100, pct)), sampleSize };
}

export { MIN_ACCURACY_SAMPLE };
