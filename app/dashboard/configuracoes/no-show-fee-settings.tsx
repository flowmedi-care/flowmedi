"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  updateClinicNoShowFeeSettings,
  type NoShowFeeMode,
} from "@/app/dashboard/agenda/appointment-status-change";
import { toast } from "@/components/ui/toast";

export function NoShowFeeSettings({
  initial,
}: {
  initial: {
    mode: NoShowFeeMode;
    amount: number | null;
    percent: number | null;
    serviceId: string | null;
  };
}) {
  const [mode, setMode] = useState<NoShowFeeMode>(initial.mode);
  const [amount, setAmount] = useState(
    initial.amount != null ? String(initial.amount) : ""
  );
  const [percent, setPercent] = useState(
    initial.percent != null ? String(initial.percent) : ""
  );
  const [serviceId, setServiceId] = useState(initial.serviceId ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const res = await updateClinicNoShowFeeSettings({
      mode,
      amount: amount ? parseFloat(amount.replace(",", ".")) : null,
      percent: percent ? parseFloat(percent.replace(",", ".")) : null,
      serviceId: serviceId.trim() || null,
    });
    setLoading(false);
    if (res.error) toast(res.error, "error");
    else toast("Taxa de falta atualizada.", "success");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Taxa de falta (no-show)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Usada no wizard ao marcar falta na agenda. Consultas canceladas não aplicam taxa
          automaticamente.
        </p>
        <div className="space-y-2">
          <Label>Modo</Label>
          <select
            className="h-9 w-full rounded-md border px-3 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value as NoShowFeeMode)}
          >
            <option value="none">Desativada</option>
            <option value="fixed">Valor fixo (R$)</option>
            <option value="percent_service">Percentual do serviço da consulta</option>
            <option value="service">Serviço dedicado (UUID)</option>
          </select>
        </div>
        {mode === "fixed" && (
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50,00" />
          </div>
        )}
        {mode === "percent_service" && (
          <div className="space-y-2">
            <Label>Percentual (%)</Label>
            <Input value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="50" />
          </div>
        )}
        {mode === "service" && (
          <div className="space-y-2">
            <Label>ID do serviço de taxa de falta</Label>
            <Input
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              placeholder="UUID do serviço em Serviços e Valores"
            />
          </div>
        )}
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Salvando…" : "Salvar taxa de falta"}
        </Button>
      </CardContent>
    </Card>
  );
}
