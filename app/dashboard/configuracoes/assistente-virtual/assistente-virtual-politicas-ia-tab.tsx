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
import type { BookingSettings } from "@/lib/assistant-capabilities/booking/types";
import { checkInSettingsToPolicyInput } from "@/lib/assistant-capabilities/check-in/mapper";
import type { CheckInSettings } from "@/lib/assistant-capabilities/check-in/types";
import { generalToVaPatch } from "@/lib/assistant-capabilities/general/mapper";
import type { GeneralSettings } from "@/lib/assistant-capabilities/general/types";
import { financeToGoals, financeToVaPatch } from "@/lib/assistant-capabilities/finance/mapper";
import type { FinanceSettings } from "@/lib/assistant-capabilities/finance/types";
import { capabilities, type AnyCapability } from "./capabilities/registry";

export function AssistenteVirtualPoliticasIaTab({
  initialPolicy,
  initialConversationFlows,
  initialVaSettings,
}: {
  initialPolicy: AppointmentPolicy;
  initialConversationFlows: ConversationFlowsConfig;
  initialVaSettings: Partial<VirtualAssistantSettings>;
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
      if (capId === "booking") {
        const booking = saved as BookingSettings;
        return {
          ...prev,
          conversationFlows: applyBookingToFlows(prev.conversationFlows, booking),
          appointmentPolicy: {
            ...prev.appointmentPolicy,
            goals: {
              ...prev.appointmentPolicy.goals,
              ...bookingSettingsToGoals(booking),
            },
          },
        };
      }
      if (capId === "check_in") {
        return {
          ...prev,
          appointmentPolicy: mergeAppointmentPolicy({
            goals: prev.appointmentPolicy.goals,
            check_in: checkInSettingsToPolicyInput(saved as CheckInSettings),
          }),
        };
      }
      if (capId === "general") {
        return {
          ...prev,
          vaSettings: { ...prev.vaSettings, ...generalToVaPatch(saved as GeneralSettings) },
        };
      }
      if (capId === "finance") {
        const finance = saved as FinanceSettings;
        return {
          ...prev,
          appointmentPolicy: {
            ...prev.appointmentPolicy,
            goals: {
              ...prev.appointmentPolicy.goals,
              ...financeToGoals(finance),
            },
          },
          vaSettings: { ...prev.vaSettings, ...financeToVaPatch(finance) },
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
      <SegmentedTabs tabs={tabs} value={selectedId} onChange={selectCapability} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{capability.title}</CardTitle>
          <CardDescription>{summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form value={value as never} onChange={setValue as never} />
          {capability.id !== "knowledge" && capability.id !== "advanced" ? (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
