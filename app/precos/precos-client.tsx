"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Shield, Zap } from "lucide-react";

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
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 max-w-7xl mx-auto">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-6 animate-pulse"
          >
            <div className="h-4 bg-muted rounded w-3/4 mb-4" />
            <div className="h-10 bg-muted rounded w-1/2 mb-2" />
            <div className="h-5 bg-muted rounded w-2/3 mb-6" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="h-4 bg-muted rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-6 rounded-2xl border border-border bg-card">
        <p className="text-muted-foreground mb-4">
          Nenhum plano configurado. Configure os planos no painel administrativo.
        </p>
        <Link href="/criar-conta">
          <Button>Criar conta</Button>
        </Link>
      </div>
    );
  }

  const gridCols =
    plans.length === 1
      ? "md:grid-cols-1 max-w-sm mx-auto"
      : plans.length === 2
        ? "md:grid-cols-2 max-w-2xl mx-auto"
        : plans.length === 3
          ? "md:grid-cols-3 max-w-4xl mx-auto"
          : "md:grid-cols-2 xl:grid-cols-4 max-w-7xl mx-auto";

  return (
    <div className="space-y-12">
      {/* Cards grid */}
      <div className={`grid gap-5 sm:gap-6 ${gridCols}`}>
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`
              relative flex flex-col rounded-2xl border bg-card transition-all duration-200
              ${plan.highlighted
                ? "border-primary shadow-xl shadow-primary/10 md:scale-[1.02] z-10 ring-2 ring-primary/20"
                : "border-border hover:border-primary/40 hover:shadow-lg"
              }
            `}
          >
            {/* Popular badge */}
            {plan.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  Mais popular
                </span>
              </div>
            )}

            <div className={`flex flex-col flex-1 p-6 sm:p-7 ${plan.highlighted ? "pt-8 sm:pt-9" : ""}`}>
              {/* Header */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground tracking-tight">
                  {plan.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground tracking-tight">
                    {plan.price_display || "—"}
                  </span>
                </div>
                {plan.description && (
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {plan.description}
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="flex-1 space-y-3 min-h-0">
                {(plan.features || []).slice(0, 10).map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 text-sm text-muted-foreground"
                  >
                    <Check
                      className="h-4 w-4 shrink-0 mt-0.5 text-primary"
                      strokeWidth={2.5}
                    />
                    <span className="leading-snug">{f}</span>
                  </li>
                ))}
              </ul>
              {(plan.features?.length ?? 0) > 10 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  + {(plan.features?.length ?? 0) - 10} itens
                </p>
              )}

              {/* CTA */}
              <div className="mt-6 pt-6 border-t border-border">
                <Link
                  href={
                    plan.stripe_price_id
                      ? `${plan.cta_href || "/dashboard/plano"}?plan=${encodeURIComponent(plan.slug)}`
                      : plan.cta_href || "/criar-conta"
                  }
                  className="block"
                >
                  <Button
                    className="w-full h-11 font-medium"
                    variant={plan.highlighted ? "default" : "outline"}
                    size="lg"
                  >
                    {plan.cta_text || "Começar"}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trust & info footer */}
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary/70" />
            Sem fidelidade
          </span>
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary/70" />
            Cancele quando quiser
          </span>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground max-w-xl mx-auto">
          Mensagens oficiais do WhatsApp são cobradas diretamente pela Meta conforme o volume utilizado pela clínica.
        </p>
      </div>
    </div>
  );
}
