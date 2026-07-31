import type { OnboardingTourStep } from "./types";
import { STEP_COPY } from "./copy";

/** Progresso da clínica “ficando viva” (não passos de tutorial). */
export function clinicProgressPercent(step: OnboardingTourStep | null): number {
  switch (step) {
    case null:
      return 0;
    case "contact":
      return 20;
    case "appointment":
      return 40;
    case "attendance":
      return 60;
    case "payment":
      return 80;
    case "aha":
    case "done":
      return 100;
    case "skipped":
      return 0;
    default:
      return 0;
  }
}

export function clinicProgressStatus(step: OnboardingTourStep | null): string {
  if (!step || step === "skipped") {
    return "Vamos ligar sua clínica.";
  }
  if (step === "aha" || step === "done") {
    return "Sua clínica já está funcionando.";
  }
  const copy = STEP_COPY[step as keyof typeof STEP_COPY];
  return copy?.progressStatus ?? "Sua clínica está ganhando vida.";
}

export function nextStepAfter(
  current: OnboardingTourStep | null
): OnboardingTourStep | null {
  const order: OnboardingTourStep[] = [
    "contact",
    "appointment",
    "attendance",
    "payment",
    "aha",
    "done",
  ];
  if (!current) return "contact";
  const i = order.indexOf(current);
  if (i < 0 || i >= order.length - 1) return current;
  return order[i + 1]!;
}
