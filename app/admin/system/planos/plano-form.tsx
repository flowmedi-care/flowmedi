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
  price_display?: string | null;
  features?: string[] | null;
  sort_order?: number | null;
  show_on_pricing?: boolean | null;
  highlighted?: boolean | null;
  cta_text?: string | null;
  cta_href?: string | null;
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
    storage_mb: plan?.storage_mb ? (Number(plan.storage_mb) / 1024).toFixed(1) : "",
    whatsapp_enabled: plan?.whatsapp_enabled ?? false,
    email_enabled: plan?.email_enabled ?? false,
    custom_logo_enabled: plan?.custom_logo_enabled ?? false,
    priority_support: plan?.priority_support ?? false,
    stripe_price_id: plan?.stripe_price_id || "",
    is_active: plan?.is_active ?? true,
    price_display: plan?.price_display || "",
    features: Array.isArray(plan?.features)
      ? plan.features.join("\n")
      : "",
    sort_order: plan?.sort_order?.toString() ?? "0",
    show_on_pricing: plan?.show_on_pricing ?? false,
    highlighted: plan?.highlighted ?? false,
    cta_text: plan?.cta_text || "",
    cta_href: plan?.cta_href || "",
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

      // Converter GB para MB (storage_mb no banco é em MB)
      // Se o usuário digitar 0.3 GB, converte para 307 MB (0.3 * 1024 = 307.2 → 307)
      const storageMB = formData.storage_mb && formData.storage_mb.trim() !== ""
        ? (() => {
            const gbValue = parseFloatOrNull(formData.storage_mb);
            if (gbValue === null || gbValue === 0) return null;
            // Validar: máximo 1000 GB (1 TB) para evitar overflow
            if (gbValue > 1000) {
              throw new Error("Armazenamento muito grande. Máximo permitido: 1000 GB (1 TB)");
            }
            const mbValue = Math.round(gbValue * 1024);
            // Validar: máximo 2.147.483.647 MB (limite do int32)
            if (mbValue > 2147483647) {
              throw new Error("Armazenamento muito grande. Máximo permitido: 2097151 GB");
            }
            return mbValue;
          })()
        : null;

      // Validar stripe_price_id: deve começar com "price_" ou ser vazio/null
      const stripePriceId = formData.stripe_price_id?.trim() || null;
      if (stripePriceId && !stripePriceId.startsWith("price_")) {
        throw new Error('Stripe Price ID deve começar com "price_" (ex: price_1ABC123...). Você colou um número?');
      }

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
        storage_mb: storageMB,
        whatsapp_enabled: formData.whatsapp_enabled,
        email_enabled: formData.email_enabled,
        custom_logo_enabled: formData.custom_logo_enabled,
        priority_support: formData.priority_support,
        stripe_price_id: stripePriceId,
        is_active: formData.is_active,
        price_display: formData.price_display?.trim() || null,
        features: formData.features
          ? formData.features
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        sort_order: parseInt(formData.sort_order, 10) || 0,
        show_on_pricing: formData.show_on_pricing,
        highlighted: formData.highlighted,
        cta_text: formData.cta_text?.trim() || null,
        cta_href: formData.cta_href?.trim() || null,
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

      {/* Exibição na Página de Preços */}
      <Card>
        <CardHeader>
          <CardTitle>Exibição na Página de Preços</CardTitle>
          <CardDescription>
            O que aparece em /precos. Alterações aqui refletem automaticamente na página pública.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="show_on_pricing">Exibir na página de preços</Label>
              <p className="text-xs text-muted-foreground">Se ativo, o plano aparece em /precos</p>
            </div>
            <Switch
              id="show_on_pricing"
              checked={formData.show_on_pricing}
              onChange={(checked) => setFormData({ ...formData, show_on_pricing: checked })}
            />
          </div>
          <div>
            <Label htmlFor="price_display">Preço exibido</Label>
            <Input
              id="price_display"
              value={formData.price_display}
              onChange={(e) => setFormData({ ...formData, price_display: e.target.value })}
              placeholder="R$89/mês ou Sob consulta"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Texto mostrado como preço. Ex: R$89/mês, R$347/mês, Sob consulta.
            </p>
          </div>
          <div>
            <Label htmlFor="features">Features (uma por linha)</Label>
            <Textarea
              id="features"
              value={formData.features}
              onChange={(e) => setFormData({ ...formData, features: e.target.value })}
              rows={8}
              placeholder={"Até 2 profissionais de saúde\nAté 2 secretárias\n500 consultas por mês"}
              className="font-mono text-sm"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="sort_order">Ordem de exibição</Label>
              <Input
                id="sort_order"
                type="number"
                min="0"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Menor = aparece primeiro</p>
            </div>
            <div className="flex items-center justify-between pt-8">
              <div>
                <Label htmlFor="highlighted">Destacar (Popular)</Label>
                <p className="text-xs text-muted-foreground">Mostra badge no card</p>
              </div>
              <Switch
                id="highlighted"
                checked={formData.highlighted}
                onChange={(checked) => setFormData({ ...formData, highlighted: checked })}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="cta_text">Texto do botão</Label>
              <Input
                id="cta_text"
                value={formData.cta_text}
                onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })}
                placeholder="Assinar Essencial"
              />
            </div>
            <div>
              <Label htmlFor="cta_href">URL do botão</Label>
              <Input
                id="cta_href"
                value={formData.cta_href}
                onChange={(e) => setFormData({ ...formData, cta_href: e.target.value })}
                placeholder="/dashboard/plano ou /criar-conta"
              />
            </div>
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
              onChange={(e) => {
                const value = e.target.value.trim();
                // Validar formato básico: deve começar com "price_"
                if (value && !value.startsWith("price_")) {
                  toast("Stripe Price ID deve começar com 'price_' (ex: price_1ABC123...)", "error");
                  return;
                }
                setFormData({ ...formData, stripe_price_id: value });
              }}
              placeholder="price_xxxxx"
            />
            <p className="text-xs text-muted-foreground mt-1">
              ID do Price criado no Stripe Dashboard (ex: price_1ABC123...). Cole apenas o ID, não números grandes.
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
