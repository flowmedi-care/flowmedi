"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
    max_doctors_custom: number | null;
    max_secretaries_custom: number | null;
  };
  plans: Plan[];
}

export function ClinicaForm({ clinic, plans }: ClinicaFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    plan_id: clinic.plan_id || "",
    subscription_status: clinic.subscription_status || "",
    max_doctors_custom: clinic.max_doctors_custom?.toString() || "",
    max_secretaries_custom: clinic.max_secretaries_custom?.toString() || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Helper para converter string vazia em null
      const parseNumberOrNull = (value: string): number | null => {
        if (!value || value.trim() === "") return null;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
      };

      const payload: Record<string, unknown> = {
        plan_id: formData.plan_id || null,
        subscription_status: formData.subscription_status || null,
        max_doctors_custom: parseNumberOrNull(formData.max_doctors_custom),
        max_secretaries_custom: parseNumberOrNull(formData.max_secretaries_custom),
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

      {/* Limites Customizados */}
      <Card>
        <CardHeader>
          <CardTitle>Limites Customizados</CardTitle>
          <CardDescription>
            Defina limites específicos para esta clínica. Se deixar em branco, usará os limites do
            plano. Útil para free pass Pro com restrições (ex: limitar médicos/secretários).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="max_doctors_custom">Limite de Médicos (Customizado)</Label>
            <Input
              id="max_doctors_custom"
              type="number"
              min="0"
              value={formData.max_doctors_custom}
              onChange={(e) =>
                setFormData({ ...formData, max_doctors_custom: e.target.value })
              }
              placeholder="Deixe em branco para usar limite do plano"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se definido, este limite sobrescreve o limite do plano. Deixe em branco para usar o
              limite padrão do plano.
            </p>
          </div>

          <div>
            <Label htmlFor="max_secretaries_custom">Limite de Secretários (Customizado)</Label>
            <Input
              id="max_secretaries_custom"
              type="number"
              min="0"
              value={formData.max_secretaries_custom}
              onChange={(e) =>
                setFormData({ ...formData, max_secretaries_custom: e.target.value })
              }
              placeholder="Deixe em branco para usar limite do plano"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se definido, este limite sobrescreve o limite do plano. Deixe em branco para usar o
              limite padrão do plano.
            </p>
          </div>

          {(formData.max_doctors_custom || formData.max_secretaries_custom) && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                ℹ️ Limites customizados ativos. Esta clínica usará esses limites ao invés dos
                limites padrão do plano.
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
