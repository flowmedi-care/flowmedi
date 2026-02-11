import { redirect } from "next/navigation";
import { requireSystemAdmin } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft } from "lucide-react";

export default async function PlanosPage() {
  await requireSystemAdmin();

  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .order("created_at");

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/system">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Planos</h1>
            <p className="text-muted-foreground mt-2">
              Configure os planos disponíveis no sistema
            </p>
          </div>
        </div>
        <Link href="/admin/system/planos/novo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Plano
          </Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {!plans || plans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhum plano cadastrado</p>
              <Link href="/admin/system/planos/novo">
                <Button className="mt-4">Criar primeiro plano</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {plan.name}
                      <Badge variant={plan.is_active ? "default" : "secondary"}>
                        {plan.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Slug: <code className="text-xs">{plan.slug}</code>
                      {plan.description && ` • ${plan.description}`}
                    </CardDescription>
                  </div>
                  <Link href={`/admin/system/planos/${plan.id}`}>
                    <Button variant="outline">Editar</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Médicos:</span>{" "}
                    {plan.max_doctors === null ? "Ilimitado" : plan.max_doctors}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Secretários:</span>{" "}
                    {plan.max_secretaries === null ? "Ilimitado" : plan.max_secretaries}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Consultas/mês:</span>{" "}
                    {plan.max_appointments_per_month === null
                      ? "Ilimitado"
                      : plan.max_appointments_per_month}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Armazenamento:</span>{" "}
                    {plan.storage_mb === null || plan.storage_mb === undefined
                      ? "Ilimitado"
                      : `${(Number(plan.storage_mb) / 1024).toFixed(1)} GB`}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Formulários:</span>{" "}
                    {plan.max_form_templates === null ? "Ilimitado" : plan.max_form_templates}
                  </div>
                  <div>
                    <span className="text-muted-foreground">WhatsApp:</span>{" "}
                    <Badge variant={plan.whatsapp_enabled ? "default" : "secondary"}>
                      {plan.whatsapp_enabled ? "Sim" : "Não"}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">E-mail:</span>{" "}
                    <Badge variant={plan.email_enabled ? "default" : "secondary"}>
                      {plan.email_enabled ? "Sim" : "Não"}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Logo personalizada:</span>{" "}
                    <Badge variant={plan.custom_logo_enabled ? "default" : "secondary"}>
                      {plan.custom_logo_enabled ? "Sim" : "Não"}
                    </Badge>
                  </div>
                </div>
                {plan.stripe_price_id && (
                  <div className="mt-4 pt-4 border-t">
                    <span className="text-xs text-muted-foreground">
                      Stripe Price ID: <code>{plan.stripe_price_id}</code>
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
