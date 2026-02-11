import { redirect } from "next/navigation";
import { requireSystemAdmin } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit } from "lucide-react";

export default async function ClinicasPage() {
  await requireSystemAdmin();

  const supabase = await createClient();
  
  // Buscar todas as clínicas com seus planos
  const { data: clinics } = await supabase
    .from("clinics")
    .select(`
      id,
      name,
      slug,
      plan_id,
      subscription_status,
      stripe_customer_id,
      stripe_subscription_id,
      created_at,
      plans:plan_id (
        id,
        name,
        slug
      )
    `)
    .order("created_at", { ascending: false });

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
            <h1 className="text-3xl font-bold">Gerenciar Clínicas</h1>
            <p className="text-muted-foreground mt-2">
              Visualize e gerencie planos e assinaturas das clínicas
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {!clinics || clinics.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhuma clínica cadastrada</p>
            </CardContent>
          </Card>
        ) : (
          clinics.map((clinic) => {
            const plan = Array.isArray(clinic.plans) ? clinic.plans[0] : clinic.plans;
            const planName = plan?.name || "Sem plano";
            const planSlug = plan?.slug || null;
            const isPro = planSlug === "pro" && clinic.subscription_status === "active";
            
            return (
              <Card key={clinic.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {clinic.name}
                        {isPro && (
                          <Badge variant="default" className="bg-green-600">
                            Pro Ativo
                          </Badge>
                        )}
                        {planSlug === "pro" && clinic.subscription_status !== "active" && (
                          <Badge variant="secondary">
                            Pro {clinic.subscription_status || "Inativo"}
                          </Badge>
                        )}
                        {planSlug === "starter" && (
                          <Badge variant="outline">Starter</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {clinic.slug && (
                          <>
                            Slug: <code className="text-xs">{clinic.slug}</code>
                            {" • "}
                          </>
                        )}
                        Criada em: {new Date(clinic.created_at).toLocaleDateString("pt-BR")}
                      </CardDescription>
                    </div>
                    <Link href={`/admin/system/clinicas/${clinic.id}`}>
                      <Button variant="outline">
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Plano:</span>{" "}
                      <strong>{planName}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      {clinic.subscription_status ? (
                        <Badge
                          variant={
                            clinic.subscription_status === "active"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {clinic.subscription_status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Sem assinatura</span>
                      )}
                    </div>
                    {clinic.stripe_customer_id && (
                      <div>
                        <span className="text-muted-foreground">Stripe Customer:</span>{" "}
                        <code className="text-xs">{clinic.stripe_customer_id}</code>
                      </div>
                    )}
                    {clinic.stripe_subscription_id && (
                      <div>
                        <span className="text-muted-foreground">Stripe Subscription:</span>{" "}
                        <code className="text-xs">{clinic.stripe_subscription_id}</code>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
