"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { SegmentedTabs } from "@/components/dashboard-ui/layout/segmented-tabs";
import type { AppointmentPolicy, ConversationFlowsConfig } from "@/lib/attendance-flow/types";
import { mergeAppointmentPolicy } from "@/lib/attendance-flow/defaults";
import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import type { CapabilityLoadContext } from "@/lib/assistant-capabilities/types";
import {
  applyBookingToFlows,
  bookingSettingsToGoals,
} from "@/lib/assistant-capabilities/booking/mapper";
import { checkInSettingsToPolicyInput } from "@/lib/assistant-capabilities/check-in/mapper";
import { generalToVaPatch } from "@/lib/assistant-capabilities/general/mapper";
import type { GeneralSettings } from "@/lib/assistant-capabilities/general/types";
import type { AttendanceSettings } from "./capabilities/attendance-form";
import type { KnowledgeAclSettings } from "@/lib/assistant-capabilities/knowledge/types";
import type { FinanceActionSettings } from "@/lib/assistant-capabilities/finance/action-types";
import { capabilities, type AnyCapability } from "./capabilities/registry";

export function AssistenteVirtualPoliticasIaTab({
  initialPolicy,
  initialConversationFlows,
  initialVaSettings,
  canUse,
}: {
  initialPolicy: AppointmentPolicy;
  initialConversationFlows: ConversationFlowsConfig;
  initialVaSettings: Partial<VirtualAssistantSettings>;
  canUse: boolean;
}) {
  const [selectedId, setSelectedId] = useState(capabilities[0]!.id);
  const [saving, setSaving] = useState(false);
  const [ctx, setCtx] = useState<CapabilityLoadContext>({
    appointmentPolicy: initialPolicy,
    conversationFlows: initialConversationFlows,
    vaSettings: initialVaSettings,
  });

  const capability = (capabilities.find((c) => c.id === selectedId) ??
    capabilities[0]!) as AnyCapability;

  const [value, setValue] = useState(() => capability.load(ctx));

  const tabs = useMemo(
    () =>
      [...capabilities]
        .sort((a, b) => a.order - b.order)
        .map((c) => ({ id: c.id, label: c.title })),
    []
  );

  function selectCapability(id: string) {
    const next = (capabilities.find((c) => c.id === id) ?? capabilities[0]!) as AnyCapability;
    setSelectedId(next.id);
    setValue(next.load(ctx) as typeof value);
  }

  function refreshCtxAfterSave(capId: string, saved: unknown) {
    setCtx((prev) => {
      if (capId === "attendance") {
        const attendance = saved as AttendanceSettings;
        return {
          ...prev,
          conversationFlows: applyBookingToFlows(prev.conversationFlows, attendance.booking),
          appointmentPolicy: mergeAppointmentPolicy({
            goals: {
              ...prev.appointmentPolicy.goals,
              ...bookingSettingsToGoals(attendance.booking),
            },
            check_in: checkInSettingsToPolicyInput(attendance.checkIn),
            knowledge_acl: prev.appointmentPolicy.knowledge_acl,
            finance_actions: prev.appointmentPolicy.finance_actions,
          }),
        };
      }
      if (capId === "general") {
        return {
          ...prev,
          vaSettings: { ...prev.vaSettings, ...generalToVaPatch(saved as GeneralSettings) },
        };
      }
      if (capId === "conhecimento") {
        return {
          ...prev,
          appointmentPolicy: {
            ...prev.appointmentPolicy,
            knowledge_acl: saved as KnowledgeAclSettings,
          },
        };
      }
      if (capId === "acoes_financeiras") {
        return {
          ...prev,
          appointmentPolicy: {
            ...prev.appointmentPolicy,
            finance_actions: saved as FinanceActionSettings,
          },
        };
      }
      return prev;
    });
  }

  async function handleSave() {
    setSaving(true);
    const res = await capability.save(ctx, value as never);
    setSaving(false);
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    toast("Configurações salvas.", "success");
    refreshCtxAfterSave(capability.id, value);
  }

  const Form = capability.Form;
  const summary = capability.summary?.(value as never) ?? capability.description;

  return (
    <div className="space-y-4">
      {!canUse ? (
        <p className="text-sm text-amber-800">
          Plano sem assistente virtual — salve as políticas, mas a IA no WhatsApp permanece off até
          o upgrade.
        </p>
      ) : null}
      <SegmentedTabs tabs={tabs} value={selectedId} onChange={selectCapability} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{capability.title}</CardTitle>
          <CardDescription>{summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form value={value as never} onChange={setValue as never} />
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
