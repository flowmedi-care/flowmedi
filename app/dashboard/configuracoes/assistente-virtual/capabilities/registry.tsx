"use client";

import { saveAppointmentPolicyPatch } from "../../agendamento/actions";
import { saveConversationFlows } from "../flows-actions";
import { saveVirtualAssistantSettings, type SaveVirtualAssistantInput } from "../actions";
import type { Capability } from "@/lib/assistant-capabilities/types";
import { bookingDefaults } from "@/lib/assistant-capabilities/booking/defaults";
import {
  applyBookingToFlows,
  bookingSettingsToGoals,
  policyToBookingSettings,
} from "@/lib/assistant-capabilities/booking/mapper";
import { checkInDefaults } from "@/lib/assistant-capabilities/check-in/defaults";
import {
  checkInSettingsToPolicyInput,
  policyToCheckInSettings,
} from "@/lib/assistant-capabilities/check-in/mapper";
import { generalDefaults } from "@/lib/assistant-capabilities/general/defaults";
import {
  generalToVaPatch,
  vaSettingsToGeneral,
} from "@/lib/assistant-capabilities/general/mapper";
import type { GeneralSettings } from "@/lib/assistant-capabilities/general/types";
import { knowledgeAclDefaults } from "@/lib/assistant-capabilities/knowledge/types";
import type { KnowledgeAclSettings } from "@/lib/assistant-capabilities/knowledge/types";
import { policyToKnowledgeAcl } from "@/lib/assistant-capabilities/knowledge/mapper";
import {
  financeActionDefaults,
  type FinanceActionSettings,
} from "@/lib/assistant-capabilities/finance/action-types";
import { GeneralCapabilityForm } from "./general-form";
import { AttendanceCapabilityForm, type AttendanceSettings } from "./attendance-form";
import { KnowledgeCapabilityForm } from "./knowledge-form";
import { FinanceActionsForm } from "./finance-actions-form";

export const GeneralCapability: Capability<GeneralSettings> = {
  id: "general",
  title: "Geral",
  description: "Comportamento do assistente (sem conteúdo).",
  order: 1,
  defaults: generalDefaults,
  load: (ctx) => vaSettingsToGeneral(ctx.vaSettings),
  save: async (_ctx, value) => {
    const res = await saveVirtualAssistantSettings(
      generalToVaPatch(value) as SaveVirtualAssistantInput
    );
    return { error: res.error ?? null };
  },
  Form: GeneralCapabilityForm,
};

export const AttendanceCapability: Capability<AttendanceSettings> = {
  id: "attendance",
  title: "Atendimento",
  description: "Capacidades de agendamento, check-in, cancelamento e remarcação.",
  order: 2,
  defaults: () => ({
    booking: bookingDefaults(),
    checkIn: checkInDefaults(),
  }),
  load: (ctx) => ({
    booking: policyToBookingSettings(ctx.appointmentPolicy, ctx.conversationFlows),
    checkIn: policyToCheckInSettings(ctx.appointmentPolicy),
  }),
  save: async (ctx, value) => {
    const goalsRes = await saveAppointmentPolicyPatch({
      goals: bookingSettingsToGoals(value.booking),
      check_in: checkInSettingsToPolicyInput(value.checkIn),
    });
    if (goalsRes.error) return { error: goalsRes.error };
    const nextFlows = applyBookingToFlows(ctx.conversationFlows, value.booking);
    const flowsRes = await saveConversationFlows(nextFlows.workflows);
    return { error: flowsRes.error ?? null };
  },
  Form: AttendanceCapabilityForm,
};

export const KnowledgeCapability: Capability<KnowledgeAclSettings> = {
  id: "conhecimento",
  title: "Conhecimento",
  description: "Fontes de informação que a IA pode consultar.",
  order: 3,
  defaults: knowledgeAclDefaults,
  load: (ctx) => policyToKnowledgeAcl(ctx.appointmentPolicy),
  save: async (_ctx, value) => {
    const res = await saveAppointmentPolicyPatch({ knowledge_acl: value });
    return { error: res.error ?? null };
  },
  Form: KnowledgeCapabilityForm,
};

export const FinanceActionsCapability: Capability<FinanceActionSettings> = {
  id: "acoes_financeiras",
  title: "Ações Financeiras",
  description: "Permissões de ação (não dados).",
  order: 4,
  defaults: financeActionDefaults,
  load: (ctx) => ctx.appointmentPolicy.finance_actions ?? financeActionDefaults(),
  save: async (_ctx, value) => {
    const res = await saveAppointmentPolicyPatch({ finance_actions: value });
    return { error: res.error ?? null };
  },
  Form: FinanceActionsForm,
};

/** Registry order drives Políticas tabs. */
export const capabilities = [
  GeneralCapability,
  AttendanceCapability,
  KnowledgeCapability,
  FinanceActionsCapability,
] as const;

export type AnyCapability = (typeof capabilities)[number];
