"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PricingCards, type PlanPricing } from "@/components/landing/pricing-cards";
import type { BillingCycle } from "@/lib/billing-cycle";

export function PrecosClient() {
  const [plans, setPlans] = useState<PlanPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  useEffect(() => {
    fetch("/api/plans/pricing", { cache: "force-cache" })
      .then((res) => res.json())
      .then((data) => {
        if (data.plans && Array.isArray(data.plans)) {
          setPlans(
            data.plans.map((p: PlanPricing & { features?: string[] | null }) => ({
              ...p,
              features: Array.isArray(p.features) ? p.features : [],
              has_annual_price: Boolean(p.has_annual_price),
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
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-4 h-4 w-3/4 rounded bg-muted" />
            <div className="mb-2 h-10 w-1/2 rounded bg-muted" />
            <div className="mb-6 h-5 w-2/3 rounded bg-muted" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="h-4 rounded bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <p className="mb-4 text-muted-foreground">
          Nenhum plano configurado. Configure os planos no painel administrativo.
        </p>
        <Link href="/criar-conta">
          <Button>Criar conta</Button>
        </Link>
      </div>
    );
  }

  return (
    <PricingCards
      plans={plans}
      billingCycle={billingCycle}
      onCycleChange={setBillingCycle}
    />
  );
}
