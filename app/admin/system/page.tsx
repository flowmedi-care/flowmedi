import { redirect } from "next/navigation";
import { requireSystemAdmin } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Users, TrendingUp, CreditCard } from "lucide-react";

export default async function SystemAdminPage() {
  await requireSystemAdmin();

  const supabase = await createClient();

  // Buscar estatísticas
  const [plansResult, clinicsResult, starterClinicsResult, proClinicsResult] = await Promise.all([
    supabase.from("plans").select("id, name, slug, is_active").order("created_at"),
    supabase.from("clinics").select("id", { count: "exact", head: true }),
    supabase
      .from("clinics")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", (await supabase.from("plans").select("id").eq("slug", "starter").single()).data?.id || ""),
    supabase
      .from("clinics")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", (await supabase.from("plans").select("id").eq("slug", "pro").single()).data?.id || ""),
  ]);

  const plans = plansResult.data ?? [];
  const totalClinics = clinicsResult.count ?? 0;
  const starterCount = starterClinicsResult.count ?? 0;
  const proCount = proClinicsResult.count ?? 0;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin do Sistema</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie planos, visualize clínicas e monitore o sistema
          </p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clínicas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClinics}</div>
            <p className="text-xs text-muted-foreground">Clínicas cadastradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plano Starter</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{starterCount}</div>
            <p className="text-xs text-muted-foreground">Clínicas no plano gratuito</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plano Pro</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{proCount}</div>
            <p className="text-xs text-muted-foreground">Clínicas pagantes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans.filter((p) => p.is_active).length}</div>
            <p className="text-xs text-muted-foreground">De {plans.length} planos cadastrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Ações rápidas */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gerenciar Planos</CardTitle>
            <CardDescription>
              Crie, edite e configure os planos disponíveis no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/system/planos">
              <Button className="w-full">
                <Settings className="mr-2 h-4 w-4" />
                Gerenciar Planos
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visualizar Clínicas</CardTitle>
            <CardDescription>
              Veja todas as clínicas cadastradas e seus planos atuais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/system/clinicas">
              <Button className="w-full" variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Ver Clínicas
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Lista de planos */}
      <Card>
        <CardHeader>
          <CardTitle>Planos Cadastrados</CardTitle>
          <CardDescription>Visão geral dos planos disponíveis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum plano cadastrado</p>
            ) : (
              plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="font-semibold">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">Slug: {plan.slug}</p>
                    </div>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <Link href={`/admin/system/planos/${plan.id}`}>
                    <Button variant="outline" size="sm">
                      Editar
                    </Button>
                  </Link>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
