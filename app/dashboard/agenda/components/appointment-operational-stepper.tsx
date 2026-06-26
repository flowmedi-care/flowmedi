"use client";

import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/ui/stepper";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import type { AppointmentOperationalState } from "../encounter-actions";

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stepCompletedAt(
  step: number,
  state: AppointmentOperationalState
): string | null {
  switch (step) {
    case 1:
      return state.appointmentScheduledAt;
    case 2:
      return state.encounterStartedAt;
    case 3:
      return state.encounterCompletedAt;
    case 4:
      return state.comandaIssuedAt;
    case 5:
      return state.lastPaymentAt ?? state.comandaClosedAt;
    default:
      return null;
  }
}

function activeStepFromState(state: AppointmentOperationalState): number {
  const { appointmentStatus, encounterStatus, comandaIssuedAt, isFullyPaid } = state;

  if (appointmentStatus === "cancelada" || appointmentStatus === "falta") return 0;
  if (isFullyPaid) return 5;
  if (comandaIssuedAt) return 5;
  if (
    encounterStatus === "finalizado_aguardando_cobranca" ||
    encounterStatus === "cobrado"
  ) {
    return 4;
  }
  if (encounterStatus === "em_andamento") return 2;
  return 1;
}

const STEPS = [
  { value: 1, title: "Agendada" },
  { value: 2, title: "Em atendimento" },
  { value: 3, title: "Clínico encerrado" },
  { value: 4, title: "Comanda emitida" },
  { value: 5, title: "Quitada" },
];

export function AppointmentOperationalStepper({
  state,
  onStepAction,
}: {
  state: AppointmentOperationalState;
  onStepAction?: (step: number) => void;
}) {
  const active = activeStepFromState(state);
  const isTerminal =
    state.appointmentStatus === "cancelada" || state.appointmentStatus === "falta";

  if (isTerminal) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center gap-2">
        <Badge variant="destructive">
          {state.appointmentStatus === "falta" ? "Falta registrada" : "Consulta cancelada"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Fluxo operacional encerrado.
        </span>
      </div>
    );
  }

  const completedThrough =
    active === 5
      ? 5
      : active === 4 && !state.isFullyPaid
        ? 3
        : active - 1;

  return (
    <div className="rounded-lg border bg-card px-3 py-4 sm:px-4">
      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
        Progresso do atendimento
      </p>
      <Stepper
        value={active}
        onValueChange={(v) => onStepAction?.(v)}
        className="w-full"
        indicators={{
          completed: <Check className="h-3.5 w-3.5" />,
        }}
      >
        <StepperNav className="pb-0 w-full min-w-0 overflow-x-auto">
          {STEPS.map((step, idx) => {
            const done =
              step.value <= completedThrough ||
              (step.value === 4 && !!state.comandaIssuedAt);
            const when = stepCompletedAt(step.value, state);
            return (
              <StepperItem
                key={step.value}
                step={step.value}
                completed={done}
                disabled={step.value > active}
                className="min-w-0"
              >
                <StepperTrigger
                  className="flex-col items-center gap-1 min-w-[4.5rem] sm:min-w-[5.5rem]"
                  onClick={() => {
                    if (step.value === 4 && !state.comandaIssuedAt) {
                      onStepAction?.(4);
                    }
                  }}
                >
                  <StepperIndicator className="h-7 w-7 text-xs" />
                  <StepperTitle className="text-[10px] sm:text-xs text-center leading-tight">
                    {step.title}
                  </StepperTitle>
                  {when && done && (
                    <span className="text-[9px] text-muted-foreground text-center">{when}</span>
                  )}
                </StepperTrigger>
                {idx < STEPS.length - 1 && (
                  <StepperSeparator className="shrink min-w-2 max-w-6 sm:max-w-10" />
                )}
              </StepperItem>
            );
          })}
        </StepperNav>
        <StepperPanel className="hidden" />
        {STEPS.map((step) => (
          <StepperContent key={step.value} value={step.value} className="hidden" />
        ))}
      </Stepper>
    </div>
  );
}
