"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  max_doctors: number | null;
  max_secretaries: number | null;
  max_appointments_per_month: number | null;
  max_patients: number | null;
  max_form_templates: number | null;
  max_custom_fields: number | null;
  storage_mb: number | null;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  custom_logo_enabled: boolean;
  priority_support: boolean;
  stripe_price_id: string | null;
  is_active: boolean;
}

interface PlanoFormProps {
  plan?: Plan;
}

export function PlanoForm({ plan }: PlanoFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: plan?.name || "",
    slug: plan?.slug || "",
    description: plan?.description || "",
    max_doctors: plan?.max_doctors?.toString() || "",
    max_secretaries: plan?.max_secretaries?.toString() || "",
    max_appointments_per_month: plan?.max_appointments_per_month?.toString() || "",
    max_patients: plan?.max_patients?.toString() || "",
    max_form_templates: plan?.max_form_templates?.toString() || "",
    max_custom_fields: plan?.max_custom_fields?.toString() || "",
    storage_mb: plan?.storage_mb ? (plan.storage_mb / 1024).toFixed(1) : "",
    whatsapp_enabled: plan?.whatsapp_enabled ?? false,
    email_enabled: plan?.email_enabled ?? false,
    custom_logo_enabled: plan?.custom_logo_enabled ?? false,
    priority_support: plan?.priority_support ?? false,
    stripe_price_id: plan?.stripe_price_id || "",
    is_active: plan?.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Função helper para converter string vazia em null
      const parseNumberOrNull = (value: string): number | null => {
        if (!value || value.trim() === "") return null;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
      };

      const parseFloatOrNull = (value: string): number | null => {
        if (!value || value.trim() === "") return null;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
      };

      const payload: Record<string, unknown> = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        max_doctors: parseNumberOrNull(formData.max_doctors),
        max_secretaries: parseNumberOrNull(formData.max_secretaries),
        max_appointments_per_month: parseNumberOrNull(formData.max_appointments_per_month),
        max_patients: parseNumberOrNull(formData.max_patients),
        max_form_templates: parseNumberOrNull(formData.max_form_templates),
        max_custom_fields: parseNumberOrNull(formData.max_custom_fields),
        storage_mb: formData.storage_mb ? Math.round((parseFloatOrNull(formData.storage_mb) || 0) * 1024) : null,
        whatsapp_enabled: formData.whatsapp_enabled,
        email_enabled: formData.email_enabled,
        custom_logo_enabled: formData.custom_logo_enabled,
        priority_support: formData.priority_support,
        stripe_price_id: formData.stripe_price_id || null,
        is_active: formData.is_active,
      };

      const url = plan ? `/api/admin/plans/${plan.id}` : "/api/admin/plans";
      const method = plan ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao salvar plano");
      }

      toast(plan ? "Plano atualizado com sucesso!" : "Plano criado com sucesso!", "success");
      router.push("/admin/system/planos");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erro ao salvar plano", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informações básicas */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
          <CardDescription>Nome, slug e descrição do plano</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Nome do Plano</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="slug">Slug (identificador único)</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
              required
              disabled={!!plan}
            />
            {plan && <p className="text-xs text-muted-foreground mt-1">Slug não pode ser alterado</p>}
          </div>
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_active">Plano Ativo</Label>
              <p className="text-xs text-muted-foreground">Planos inativos não podem ser atribuídos a clínicas</p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Limites numéricos */}
      <Card>
        <CardHeader>
          <CardTitle>Limites Numéricos</CardTitle>
          <CardDescription>Deixe em branco para ilimitado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="max_doctors">Máximo de Médicos</Label>
              <Input
                id="max_doctors"
                type="number"
                min="0"
                value={formData.max_doctors}
                onChange={(e) => setFormData({ ...formData, max_doctors: e.target.value })}
                placeholder="Ilimitado"
              />
            </div>
            <div>
              <Label htmlFor="max_secretaries">Máximo de Secretários</Label>
              <Input
                id="max_secretaries"
                type="number"
                min="0"
                value={formData.max_secretaries}
                onChange={(e) => setFormData({ ...formData, max_secretaries: e.target.value })}
                placeholder="Ilimitado"
              />
            </div>
            <div>
              <Label htmlFor="max_appointments_per_month">Consultas por Mês</Label>
              <Input
                id="max_appointments_per_month"
                type="number"
                min="0"
                value={formData.max_appointments_per_month}
                onChange={(e) => setFormData({ ...formData, max_appointments_per_month: e.target.value })}
                placeholder="Ilimitado"
              />
            </div>
            <div>
              <Label htmlFor="max_patients">Máximo de Pacientes</Label>
              <Input
                id="max_patients"
                type="number"
                min="0"
                value={formData.max_patients}
                onChange={(e) => setFormData({ ...formData, max_patients: e.target.value })}
                placeholder="Ilimitado"
              />
            </div>
            <div>
              <Label htmlFor="max_form_templates">Templates de Formulários</Label>
              <Input
                id="max_form_templates"
                type="number"
                min="0"
                value={formData.max_form_templates}
                onChange={(e) => setFormData({ ...formData, max_form_templates: e.target.value })}
                placeholder="Ilimitado"
              />
            </div>
            <div>
              <Label htmlFor="max_custom_fields">Campos Customizados</Label>
              <Input
                id="max_custom_fields"
                type="number"
                min="0"
                value={formData.max_custom_fields}
                onChange={(e) => setFormData({ ...formData, max_custom_fields: e.target.value })}
                placeholder="Ilimitado"
              />
            </div>
            <div>
              <Label htmlFor="storage_mb">Armazenamento (GB)</Label>
              <Input
                id="storage_mb"
                type="number"
                step="0.1"
                min="0"
                value={formData.storage_mb}
                onChange={(e) => setFormData({ ...formData, storage_mb: e.target.value })}
                placeholder="Ilimitado"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>Habilite ou desabilite recursos do plano</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="whatsapp_enabled">WhatsApp Transacional</Label>
              <p className="text-xs text-muted-foreground">Permite envio de mensagens via WhatsApp</p>
            </div>
            <Switch
              id="whatsapp_enabled"
              checked={formData.whatsapp_enabled}
              onChange={(checked) => setFormData({ ...formData, whatsapp_enabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email_enabled">E-mail Automático</Label>
              <p className="text-xs text-muted-foreground">Permite envio de e-mails automáticos</p>
            </div>
            <Switch
              id="email_enabled"
              checked={formData.email_enabled}
              onChange={(checked) => setFormData({ ...formData, email_enabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="custom_logo_enabled">Logo Personalizada</Label>
              <p className="text-xs text-muted-foreground">Permite upload de logo personalizada</p>
            </div>
            <Switch
              id="custom_logo_enabled"
              checked={formData.custom_logo_enabled}
              onChange={(checked) => setFormData({ ...formData, custom_logo_enabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="priority_support">Suporte Prioritário</Label>
              <p className="text-xs text-muted-foreground">Acesso a suporte prioritário</p>
            </div>
            <Switch
              id="priority_support"
              checked={formData.priority_support}
              onChange={(checked) => setFormData({ ...formData, priority_support: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stripe */}
      <Card>
        <CardHeader>
          <CardTitle>Integração Stripe</CardTitle>
          <CardDescription>Configure o preço do Stripe para planos pagos</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="stripe_price_id">Stripe Price ID</Label>
            <Input
              id="stripe_price_id"
              value={formData.stripe_price_id}
              onChange={(e) => setFormData({ ...formData, stripe_price_id: e.target.value })}
              placeholder="price_xxxxx"
            />
            <p className="text-xs text-muted-foreground mt-1">
              ID do Price criado no Stripe Dashboard (ex: price_1ABC123...)
            </p>
          </div>
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
          {loading ? "Salvando..." : plan ? "Atualizar Plano" : "Criar Plano"}
        </Button>
      </div>
    </form>
  );
}
