import { redirect, notFound } from "next/navigation";
import { requireSystemAdmin } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { ClinicaForm } from "./clinica-form";

export default async function EditarClinicaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSystemAdmin();

  const { id } = await params;
  const supabase = await createClient();

  // Buscar clínica com plano e limites customizados
  const { data: clinic } = await supabase
    .from("clinics")
    .select(`
      id,
      name,
      slug,
      plan_id,
      subscription_status,
      max_doctors_custom,
      max_secretaries_custom,
      stripe_customer_id,
      stripe_subscription_id,
      tax_id,
      tax_id_type,
      address,
      plans:plan_id (
        id,
        name,
        slug
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (!clinic) {
    notFound();
  }

  // Buscar todos os planos disponíveis
  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name");

  const plan = Array.isArray(clinic.plans) ? clinic.plans[0] : clinic.plans;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/system/clinicas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Editar Clínica</h1>
            <p className="text-muted-foreground mt-2">
              {clinic.name}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ClinicaForm
          clinic={{
            id: clinic.id,
            name: clinic.name,
            plan_id: clinic.plan_id,
            subscription_status: clinic.subscription_status,
            max_doctors_custom: clinic.max_doctors_custom,
            max_secretaries_custom: clinic.max_secretaries_custom,
          }}
          plans={plans || []}
        />

        {/* Card com dados de cobrança */}
        <Card>
          <CardHeader>
            <CardTitle>Dados de Cobrança</CardTitle>
            <CardDescription>Informações coletadas durante o checkout</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {clinic.tax_id ? (
              <div>
                <Label className="text-sm font-medium">CPF/CNPJ</Label>
                <p className="text-sm">
                  {clinic.tax_id_type === "cpf" ? "CPF" : "CNPJ"}: {clinic.tax_id}
                </p>
              </div>
            ) : (
              <div>
                <Label className="text-sm font-medium">CPF/CNPJ</Label>
                <p className="text-sm text-muted-foreground">Não informado</p>
              </div>
            )}

            {clinic.address ? (
              <div>
                <Label className="text-sm font-medium">Endereço</Label>
                <p className="text-sm">{clinic.address}</p>
              </div>
            ) : (
              <div>
                <Label className="text-sm font-medium">Endereço</Label>
                <p className="text-sm text-muted-foreground">Não informado</p>
              </div>
            )}

            {clinic.stripe_customer_id && (
              <div>
                <Label className="text-sm font-medium">Stripe Customer ID</Label>
                <p className="text-sm font-mono text-xs break-all">{clinic.stripe_customer_id}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <a
                    href={`https://dashboard.stripe.com/customers/${clinic.stripe_customer_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Ver no Stripe Dashboard →
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
