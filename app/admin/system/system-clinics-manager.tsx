"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

type PlanItem = {
  id: string;
  name: string;
  slug: string;
};

type ClinicItem = {
  id: string;
  name: string;
  plan_id: string | null;
  subscription_status: string | null;
  created_at: string;
};

type RowState = {
  plan_id: string;
  subscription_status: string;
};

export function SystemClinicsManager({
  plans,
  clinics,
}: {
  plans: PlanItem[];
  clinics: ClinicItem[];
}) {
  const [rows, setRows] = useState<Record<string, RowState>>(
    Object.fromEntries(
      clinics.map((c) => [
        c.id,
        {
          plan_id: c.plan_id ?? "",
          subscription_status: c.subscription_status ?? "",
        },
      ])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const updateRow = (clinicId: string, patch: Partial<RowState>) => {
    setRows((prev) => ({
      ...prev,
      [clinicId]: {
        ...(prev[clinicId] ?? { plan_id: "", subscription_status: "" }),
        ...patch,
      },
    }));
  };

  const saveClinic = async (clinicId: string) => {
    const row = rows[clinicId];
    if (!row) return;
    setSavingId(clinicId);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: row.plan_id || null,
          subscription_status: row.subscription_status || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar clínica");
      }
      toast("Plano da clínica atualizado com sucesso.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao atualizar clínica.", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Troca rápida de plano (sem Stripe)</CardTitle>
        <CardDescription>
          Para contas de teste em produção: altere plano e status manualmente sem checkout.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {clinics.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma clínica cadastrada.</p>
        ) : (
          <div className="space-y-3">
            {clinics.map((clinic) => {
              const row = rows[clinic.id] ?? { plan_id: "", subscription_status: "" };
              const currentPlan = plans.find((p) => p.id === row.plan_id);
              const isProLike = ["pro", "profissional", "essencial", "estrategico"].includes(
                currentPlan?.slug ?? ""
              );
              const isActive = row.subscription_status === "active";

              return (
                <div key={clinic.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{clinic.name}</p>
                    <Badge variant={isProLike && isActive ? "default" : "secondary"}>
                      {isProLike && isActive ? "Acesso pago ativo" : "Sem acesso pago ativo"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Select
                      value={row.plan_id}
                      onChange={(e) => updateRow(clinic.id, { plan_id: e.target.value })}
                    >
                      <option value="">Sem plano</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} ({plan.slug})
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={row.subscription_status}
                      onChange={(e) =>
                        updateRow(clinic.id, { subscription_status: e.target.value })
                      }
                    >
                      <option value="">Sem assinatura</option>
                      <option value="active">active</option>
                      <option value="past_due">past_due</option>
                      <option value="canceled">canceled</option>
                      <option value="unpaid">unpaid</option>
                    </Select>
                    <Button
                      onClick={() => saveClinic(clinic.id)}
                      disabled={savingId === clinic.id}
                    >
                      {savingId === clinic.id ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
