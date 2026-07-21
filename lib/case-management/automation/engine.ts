import type { CaseCommand } from "../commands";
import type { CasePhase } from "../types";
import type { DomainPolicyResult } from "../policies";

export type AutomationRule = {
  id: string;
  on: string | string[];
  priority: number;
  exclusive?: boolean;
  when?: (ctx: AutomationContext) => boolean;
  then: (ctx: AutomationContext) => CaseCommand[];
};

export type AutomationContext = {
  eventType: string;
  caseId: string;
  currentPhase: CasePhase | null;
  policy: DomainPolicyResult;
  payload: Record<string, unknown>;
  eventId: string;
};

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: "override-phase",
    on: "Case.OverrideRequested",
    priority: 100,
    exclusive: true,
    then: (ctx) => {
      const phase = ctx.payload.target_phase as CasePhase | undefined;
      if (!phase || !ctx.caseId) return [];
      return [{ type: "SetPhase", caseId: ctx.caseId, phase, reason: "override" }];
    },
  },
  {
    id: "phase-from-policy",
    on: [
      "Lead.Qualified",
      "Lead.Disqualified",
      "Lead.Converted",
      "Appointment.Created",
      "Appointment.Confirmed",
      "Appointment.Completed",
      "Appointment.NoShow",
      "Appointment.Cancelled",
      "Payment.Paid",
      "Payment.PartiallyPaid",
      "Payment.Created",
    ],
    priority: 50,
    then: (ctx) => {
      if (!ctx.policy.suggestedPhase || !ctx.caseId) return [];
      if (ctx.policy.suggestedPhase === ctx.currentPhase) return [];
      return [
        {
          type: "SetPhase",
          caseId: ctx.caseId,
          phase: ctx.policy.suggestedPhase,
          reason: ctx.eventType,
        },
      ];
    },
  },
  {
    id: "tasks-from-policy",
    on: ["Lead.Qualified", "Appointment.Completed"],
    priority: 40,
    then: (ctx) => {
      const titles = ctx.policy.createTaskTitles ?? [];
      return titles.map((title) => ({
        type: "CreateTask" as const,
        caseId: ctx.caseId,
        title,
        source_event_id: ctx.eventId,
      }));
    },
  },
  {
    id: "pending-after-qualify",
    on: "Lead.Qualified",
    priority: 30,
    then: (ctx) => [
      {
        type: "SetPendingDecision",
        caseId: ctx.caseId,
        pending: {
          type: "advance_commercial",
          waiting_for: "secretaria",
          label: "Avançar comercial / agendar",
        },
      },
    ],
  },
  {
    id: "pending-patient-confirm",
    on: "Appointment.Created",
    priority: 30,
    then: (ctx) => [
      {
        type: "SetPendingDecision",
        caseId: ctx.caseId,
        pending: {
          type: "confirm_slot",
          waiting_for: "patient",
          label: "Confirmar consulta",
        },
      },
    ],
  },
  {
    id: "clear-pending-on-confirm",
    on: "Appointment.Confirmed",
    priority: 30,
    then: (ctx) => [{ type: "ClearPendingDecision", caseId: ctx.caseId }],
  },
  {
    id: "close-on-disqualify",
    on: "Lead.Disqualified",
    priority: 60,
    then: (ctx) => [
      { type: "SetPhase", caseId: ctx.caseId, phase: "perdido" },
      { type: "CloseCase", caseId: ctx.caseId, reason: "disqualified" },
    ],
  },
];

export function runAutomation(
  ctx: AutomationContext,
  rules: AutomationRule[] = DEFAULT_RULES
): { commands: CaseCommand[]; appliedRuleIds: string[] } {
  const matching = rules
    .filter((r) => {
      const types = Array.isArray(r.on) ? r.on : [r.on];
      if (!types.includes(ctx.eventType)) return false;
      if (r.when && !r.when(ctx)) return false;
      return true;
    })
    .sort((a, b) => b.priority - a.priority);

  const commands: CaseCommand[] = [];
  const appliedRuleIds: string[] = [];
  let exclusiveTaken = false;

  for (const rule of matching) {
    if (exclusiveTaken && rule.exclusive) continue;
    const cmds = rule.then(ctx);
    if (cmds.length === 0) continue;
    commands.push(...cmds);
    appliedRuleIds.push(rule.id);
    if (rule.exclusive) exclusiveTaken = true;
  }

  return { commands, appliedRuleIds };
}

export { DEFAULT_RULES };
