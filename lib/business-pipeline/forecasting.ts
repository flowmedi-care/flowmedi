import type {
  ConfidenceLevel,
  ForecastConfidence,
  ForecastReasoning,
  ProbabilitySource,
} from "./types";
import { CONFIDENCE_LABELS } from "./types";

const SERVICE_MIN_N = 20;
const DOCTOR_MIN_N = 20;

export type NoShowBucket = {
  key: string;
  faltas: number;
  total: number;
};

export function rateFromBucket(b: NoShowBucket | undefined): number | null {
  if (!b || b.total < 1) return null;
  return b.faltas / b.total;
}

/**
 * Resolve probabilidade de no-show: serviço → médico → clínica.
 */
export function resolveNoShowProbability(input: {
  serviceId: string | null;
  doctorId: string | null;
  byService: Map<string, NoShowBucket>;
  byDoctor: Map<string, NoShowBucket>;
  clinicRate: number;
}): { rate: number; source: ProbabilitySource; sampleSize: number; fallback: boolean } {
  if (input.serviceId) {
    const b = input.byService.get(input.serviceId);
    if (b && b.total >= SERVICE_MIN_N) {
      return {
        rate: b.faltas / b.total,
        source: "service",
        sampleSize: b.total,
        fallback: false,
      };
    }
  }
  if (input.doctorId) {
    const b = input.byDoctor.get(input.doctorId);
    if (b && b.total >= DOCTOR_MIN_N) {
      return {
        rate: b.faltas / b.total,
        source: "doctor",
        sampleSize: b.total,
        fallback: true,
      };
    }
  }
  return {
    rate: input.clinicRate,
    source: "clinic",
    sampleSize: 0,
    fallback: true,
  };
}

export function buildConfidence(input: {
  sampleSize: number;
  source: ProbabilitySource;
  fallback: boolean;
}): ForecastConfidence {
  let level: ConfidenceLevel;
  if (input.sampleSize >= 200 && input.source === "service" && !input.fallback) {
    level = "muito_confiavel";
  } else if (input.sampleSize >= 50 || input.source === "doctor") {
    level = "confiavel";
  } else {
    level = "pouco_historico";
  }

  const rationale =
    input.sampleSize > 0
      ? `Baseado em ${input.sampleSize} consultas`
      : "Baseado na média da clínica (histórico específico insuficiente)";

  return {
    level,
    label: CONFIDENCE_LABELS[level],
    sampleSize: input.sampleSize,
    rationale,
  };
}

export function buildAssumptions(reasoning: ForecastReasoning): string[] {
  const list: string[] = [];
  if (reasoning.probabilitySource === "service") {
    list.push("No-show por procedimento/serviço");
  } else if (reasoning.probabilitySource === "doctor") {
    list.push("No-show por médico (fallback)");
  } else {
    list.push("Fallback para média da clínica");
  }
  list.push("Sem sazonalidade");
  if (reasoning.fallback) list.push("Usando nível de fallback no modelo");
  return list;
}

export function expectedFromAgendado(agendado: number, noShowRate: number): number {
  return agendado * (1 - Math.min(1, Math.max(0, noShowRate)));
}
