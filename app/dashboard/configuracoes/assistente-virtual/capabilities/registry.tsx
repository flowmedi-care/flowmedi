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
import type { BookingSettings } from "@/lib/assistant-capabilities/booking/types";
import { checkInDefaults } from "@/lib/assistant-capabilities/check-in/defaults";
import {
  checkInSettingsToPolicyInput,
  policyToCheckInSettings,
} from "@/lib/assistant-capabilities/check-in/mapper";
import type { CheckInSettings } from "@/lib/assistant-capabilities/check-in/types";
import { generalDefaults } from "@/lib/assistant-capabilities/general/defaults";
import {
  generalToVaPatch,
  vaSettingsToGeneral,
} from "@/lib/assistant-capabilities/general/mapper";
import type { GeneralSettings } from "@/lib/assistant-capabilities/general/types";
import { financeDefaults } from "@/lib/assistant-capabilities/finance/defaults";
import {
  financeToGoals,
  financeToVaPatch,
  toFinanceSettings,
} from "@/lib/assistant-capabilities/finance/mapper";
import type { FinanceSettings } from "@/lib/assistant-capabilities/finance/types";
import {
  knowledgeDefaults,
  type KnowledgeSettings,
} from "@/lib/assistant-capabilities/knowledge/types";
import {
  advancedDefaults,
  type AdvancedSettings,
} from "@/lib/assistant-capabilities/advanced/types";
import { BookingCapabilityForm } from "./booking-form";
import { CheckInCapabilityForm } from "./check-in-form";
import { GeneralCapabilityForm } from "./general-form";
import { FinanceCapabilityForm } from "./finance-form";
import { KnowledgeCapabilityForm } from "./knowledge-form";
import { AdvancedCapabilityForm } from "./advanced-form";

export const GeneralCapability: Capability<GeneralSettings> = {
  id: "general",
  title: "Geral",
  description: "Personalidade e funcionamento do assistente.",
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

export const BookingCapability: Capability<BookingSettings> = {
  id: "booking",
  title: "Agendamentos",
  description: "O que a IA pode fazer com consultas e quais dados pedir.",
  order: 2,
  defaults: bookingDefaults,
  load: (ctx) =>
    policyToBookingSettings(ctx.appointmentPolicy, ctx.conversationFlows),
  save: async (ctx, value) => {
    const goalsRes = await saveAppointmentPolicyPatch({
      goals: bookingSettingsToGoals(value),
    });
    if (goalsRes.error) return { error: goalsRes.error };
    const nextFlows = applyBookingToFlows(ctx.conversationFlows, value);
    const flowsRes = await saveConversationFlows(nextFlows.workflows);
    return { error: flowsRes.error ?? null };
  },
  Form: BookingCapabilityForm,
};

export const CheckInCapability: Capability<CheckInSettings> = {
  id: "check_in",
  title: "Check-in",
  description: "Permite que pacientes avisem sua chegada pelo WhatsApp.",
  order: 3,
  defaults: checkInDefaults,
  load: (ctx) => policyToCheckInSettings(ctx.appointmentPolicy),
  save: async (_ctx, value) => {
    const res = await saveAppointmentPolicyPatch({
      check_in: checkInSettingsToPolicyInput(value),
    });
    return { error: res.error ?? null };
  },
  summary: (v) =>
    v.enabled
      ? `Ativo · abre ${v.opensBeforeHours}h antes · encerra ${v.closesAfterMinutes} min após`
      : "Desativado",
  Form: CheckInCapabilityForm,
};

export const FinanceCapability: Capability<FinanceSettings> = {
  id: "finance",
  title: "Financeiro",
  description: "Cobrança e informações de pagamento nas conversas.",
  order: 4,
  defaults: financeDefaults,
  load: (ctx) => toFinanceSettings(ctx.appointmentPolicy, ctx.vaSettings),
  save: async (_ctx, value) => {
    const goalsRes = await saveAppointmentPolicyPatch({
      goals: financeToGoals(value),
    });
    if (goalsRes.error) return { error: goalsRes.error };
    const vaRes = await saveVirtualAssistantSettings(
      financeToVaPatch(value) as SaveVirtualAssistantInput
    );
    return { error: vaRes.error ?? null };
  },
  Form: FinanceCapabilityForm,
};

export const KnowledgeCapability: Capability<KnowledgeSettings> = {
  id: "knowledge",
  title: "Base de conhecimento",
  description: "FAQ, documentos e protocolos para respostas do assistente.",
  order: 5,
  defaults: knowledgeDefaults,
  load: () => knowledgeDefaults(),
  save: async () => ({ error: null }),
  Form: KnowledgeCapabilityForm,
};

export const AdvancedCapability: Capability<AdvancedSettings> = {
  id: "advanced",
  title: "Avançado",
  description: "Pipeline, ferramentas e diagnóstico.",
  order: 6,
  defaults: advancedDefaults,
  load: () => advancedDefaults(),
  save: async () => ({ error: null }),
  Form: AdvancedCapabilityForm,
};

/** Registry order drives Políticas da IA tabs. */
export const capabilities = [
  GeneralCapability,
  BookingCapability,
  CheckInCapability,
  FinanceCapability,
  KnowledgeCapability,
  AdvancedCapability,
] as const;

export type AnyCapability = (typeof capabilities)[number];
