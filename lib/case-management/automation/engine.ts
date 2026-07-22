import type { CaseCommand } from "../commands";
import type { CasePhase } from "../types";
import type { DomainPolicyResult } from "../policies";
import type { ClinicPolicyConfig } from "../policies/clinic";

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
  clinic: ClinicPolicyConfig;
  payload: Record<string, unknown>;
  eventId: string;
};

/**
 * Decision layer — interpreta Domain Event → Case Commands.
 * NÃO é dono de fase (Transition Engine é); SetPhase aqui é legado/fallback.
 */
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
    when: (ctx) => ctx.clinic.requireAppointmentConfirmation,
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
      { type: "CloseCase", caseId: ctx.caseId, reason: "disqualified" },
    ],
  },
  {
    id: "owner-on-handoff",
    on: "Handoff.Taken",
    priority: 70,
    then: (ctx) => {
      const humanId =
        typeof ctx.payload.human_user_id === "string"
          ? ctx.payload.human_user_id
          : null;
      return [
        {
          type: "AssignOwner",
          caseId: ctx.caseId,
          owner: humanId ? `human:${humanId}` : "human",
        },
      ];
    },
  },
  {
    id: "owner-ai-on-conversation",
    on: ["Conversation.Started", "Booking.Requested"],
    priority: 20,
    when: (ctx) =>
      typeof ctx.payload.actor === "string" &&
      String(ctx.payload.actor).startsWith("ai"),
    then: (ctx) => [
      { type: "AssignOwner", caseId: ctx.caseId, owner: "ai" },
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
