"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

interface Plan {
  id: string;
  name: string;
  slug: string;
}

interface ClinicaFormProps {
  clinic: {
    id: string;
    name: string;
    plan_id: string | null;
    subscription_status: string | null;
  };
  plans: Plan[];
}

export function ClinicaForm({ clinic, plans }: ClinicaFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    plan_id: clinic.plan_id || "",
    subscription_status: clinic.subscription_status || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        plan_id: formData.plan_id || null,
        subscription_status: formData.subscription_status || null,
      };

      const response = await fetch(`/api/admin/clinics/${clinic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar clínica");
      }

      toast("Clínica atualizada com sucesso!", "success");
      router.push("/admin/system/clinicas");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erro ao atualizar clínica", "error");
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === formData.plan_id);
  const isPro = selectedPlan?.slug === "pro";
  const isActive = formData.subscription_status === "active";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Plano e Assinatura</CardTitle>
          <CardDescription>
            Atribua um plano e defina o status da assinatura. Para dar acesso Pro sem Stripe,
            selecione o plano "Pro" e defina o status como "active".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="plan_id">Plano</Label>
            <Select
              id="plan_id"
              value={formData.plan_id}
              onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
            >
              <option value="">Selecione um plano</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.slug})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="subscription_status">Status da Assinatura</Label>
            <Select
              id="subscription_status"
              value={formData.subscription_status}
              onChange={(e) =>
                setFormData({ ...formData, subscription_status: e.target.value })
              }
            >
              <option value="">Sem assinatura</option>
              <option value="active">Active (Ativo)</option>
              <option value="past_due">Past Due (Atrasado)</option>
              <option value="canceled">Canceled (Cancelado)</option>
              <option value="unpaid">Unpaid (Não pago)</option>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Para dar acesso Pro sem Stripe: selecione plano "Pro" e status "active"
            </p>
          </div>

          {isPro && isActive && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                ✓ Clínica terá acesso completo ao plano Pro
              </p>
            </div>
          )}

          {isPro && !isActive && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                ⚠ Plano Pro selecionado, mas status não está "active". A clínica não terá acesso
                aos recursos Pro.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando..." : "Atualizar Clínica"}
        </Button>
      </div>
    </form>
  );
}
