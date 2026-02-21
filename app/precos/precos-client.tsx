"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Check, Sparkles } from "lucide-react";

interface PlanPricing {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_display: string | null;
  features: string[];
  highlighted: boolean;
  cta_text: string | null;
  cta_href: string | null;
  stripe_price_id?: string | null;
}

export function PrecosClient() {
  const [plans, setPlans] = useState<PlanPricing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plans/pricing")
      .then((res) => res.json())
      .then((data) => {
        if (data.plans && Array.isArray(data.plans)) {
          setPlans(
            data.plans.map((p: { features?: string[] | null; [key: string]: unknown }) => ({
              ...p,
              features: Array.isArray(p.features) ? p.features : [],
            }))
          );
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-8 bg-muted rounded w-3/4 mt-2" />
              <div className="h-10 bg-muted rounded w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="h-4 bg-muted rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Nenhum plano configurado. Configure os planos em /admin/system/planos.
        </p>
        <Link href="/criar-conta" className="mt-4 inline-block">
          <Button>Criar conta</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div
        className={`grid gap-6 max-w-6xl mx-auto ${
          plans.length === 1 ? "md:grid-cols-1 max-w-md" : plans.length === 2 ? "md:grid-cols-2" : plans.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative overflow-hidden transition-all ${
              plan.highlighted
                ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                : "border-border hover:border-primary/30"
            }`}
          >
            {plan.highlighted && (
              <div className="absolute right-4 top-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Popular
                </span>
              </div>
            )}
            <CardHeader className="pb-4">
              <p className="text-sm font-medium text-primary">
                {plan.description || plan.name}
              </p>
              <h2 className="text-xl font-semibold text-foreground">{plan.name}</h2>
              <p className="text-3xl font-bold text-foreground">
                {plan.price_display || "—"}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {(plan.features || []).map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-sm text-muted-foreground"
                  >
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={
                  plan.stripe_price_id
                    ? `${plan.cta_href || "/dashboard/plano"}?plan=${encodeURIComponent(plan.slug)}`
                    : plan.cta_href || "/criar-conta"
                }
                className="block"
              >
                <Button
                  className="w-full h-11"
                  variant={plan.highlighted ? "default" : "outline"}
                  size="lg"
                >
                  {plan.cta_text || "Ver plano"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Sem fidelidade. Cancele quando quiser. Mensagens do WhatsApp são cobradas
        diretamente pela Meta conforme o volume utilizado.
      </p>
    </>
  );
}
