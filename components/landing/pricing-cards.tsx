"use client";

import * as React from "react";
import Link from "next/link";
import { Check, X, Sparkles, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BillingCycle } from "@/lib/billing-cycle";

export type PlanPricing = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_display: string | null;
  price_display_annual?: string | null;
  features: string[];
  highlighted: boolean;
  cta_text: string | null;
  cta_href: string | null;
  stripe_price_id?: string | null;
  has_annual_price?: boolean;
};

type MarketingMeta = {
  promise: string;
  idealFor: string;
};

const MARKETING_BY_SLUG: Record<string, MarketingMeta> = {
  essencial: {
    promise: "Organize sua clínica",
    idealFor: "Ideal para profissionais autônomos.",
  },
  profissional: {
    promise: "Automatize sua operação",
    idealFor: "Ideal para clínicas em crescimento.",
  },
  estrategico: {
    promise: "Tenha controle completo da clínica",
    idealFor: "Ideal para operações estruturadas.",
  },
  corporativo: {
    promise: "Solução personalizada",
    idealFor: "Ideal para multiunidade e alto volume.",
  },
};

type ComparisonCell = boolean | string;

type ComparisonRow = {
  name: string;
  values: Record<string, ComparisonCell>;
};

type ComparisonSection = {
  title: string;
  rows: ComparisonRow[];
};

const COMPARISON_SECTIONS: ComparisonSection[] = [
  {
    title: "Operação",
    rows: [
      {
        name: "Agenda inteligente",
        values: { essencial: true, profissional: true, estrategico: true },
      },
      {
        name: "Prontuário e histórico do paciente",
        values: { essencial: true, profissional: true, estrategico: true },
      },
      {
        name: "Financeiro",
        values: { essencial: true, profissional: true, estrategico: true },
      },
      {
        name: "CRM de pacientes",
        values: { essencial: false, profissional: true, estrategico: true },
      },
      {
        name: "Auditoria de ações",
        values: { essencial: false, profissional: false, estrategico: true },
      },
      {
        name: "API e multi-equipe",
        values: { essencial: false, profissional: false, estrategico: true },
      },
    ],
  },
  {
    title: "Equipe",
    rows: [
      {
        name: "Profissionais",
        values: {
          essencial: "Até 2",
          profissional: "Até 6",
          estrategico: "Até 12",
        },
      },
      {
        name: "Secretárias",
        values: {
          essencial: "Até 2",
          profissional: "Até 5",
          estrategico: "Até 10",
        },
      },
      {
        name: "Gestão da equipe",
        values: { essencial: false, profissional: true, estrategico: true },
      },
    ],
  },
  {
    title: "Comunicação",
    rows: [
      {
        name: "WhatsApp integrado",
        values: { essencial: true, profissional: true, estrategico: true },
      },
      {
        name: "E-mail e confirmações",
        values: { essencial: true, profissional: true, estrategico: true },
      },
      {
        name: "Automação de atendimento",
        values: { essencial: false, profissional: true, estrategico: true },
      },
    ],
  },
  {
    title: "Inteligência",
    rows: [
      {
        name: "IA",
        values: {
          essencial: "Básica (limite mensal)",
          profissional: "Atendimento e automações",
          estrategico: "Operacional avançada",
        },
      },
      {
        name: "Dashboards e indicadores",
        values: { essencial: false, profissional: true, estrategico: true },
      },
      {
        name: "Painel com recomendações do dia",
        values: { essencial: false, profissional: false, estrategico: true },
      },
    ],
  },
];

const ANNUAL_DISCOUNT_PERCENT = 20;

function getMarketing(plan: PlanPricing): MarketingMeta {
  return (
    MARKETING_BY_SLUG[plan.slug] ?? {
      promise: plan.name,
      idealFor: plan.description?.split(".")[0]
        ? `${plan.description.split(".")[0]}.`
        : "Para a sua clínica.",
    }
  );
}

function ComparisonCellView({ value }: { value: ComparisonCell }) {
  if (typeof value === "string") {
    return <span className="text-sm text-foreground/90">{value}</span>;
  }
  if (value) {
    return <Check className="mx-auto h-5 w-5 text-primary" aria-label="Incluído" />;
  }
  return <X className="mx-auto h-5 w-5 text-muted-foreground/50" aria-label="Não incluído" />;
}

type PricingCardsProps = {
  plans: PlanPricing[];
  billingCycle: BillingCycle;
  onCycleChange: (cycle: BillingCycle) => void;
};

export function PricingCards({ plans, billingCycle, onCycleChange }: PricingCardsProps) {
  const paidPlans = plans.filter((p) => p.slug !== "corporativo");
  const corporativo = plans.find((p) => p.slug === "corporativo");
  const comparePlans = paidPlans.slice(0, 3);
  const anyAnnual = plans.some((p) => p.has_annual_price);

  return (
    <div className="w-full space-y-12">
      {anyAnnual && (
        <div className="flex justify-center">
          <ToggleGroup
            type="single"
            value={billingCycle}
            onValueChange={(value) => {
              if (value === "monthly" || value === "annually") {
                onCycleChange(value);
              }
            }}
            aria-label="Ciclo de cobrança"
            className="rounded-lg border border-border/60 bg-muted/40 p-1"
          >
            <ToggleGroupItem
              value="monthly"
              aria-label="Mensal"
              className="rounded-md px-6 py-1.5 text-sm font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:ring-1 data-[state=on]:ring-ring/20"
            >
              Mensal
            </ToggleGroupItem>
            <ToggleGroupItem
              value="annually"
              aria-label="Anual"
              className="relative rounded-md px-6 py-1.5 text-sm font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:ring-1 data-[state=on]:ring-ring/20"
            >
              Anual
              <span className="absolute -top-3 right-0 whitespace-nowrap rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary">
                Economize {ANNUAL_DISCOUNT_PERCENT}%
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      <div
        className={cn(
          "mx-auto grid gap-6",
          comparePlans.length >= 3
            ? "max-w-5xl md:grid-cols-3"
            : comparePlans.length === 2
              ? "max-w-2xl md:grid-cols-2"
              : "max-w-sm md:grid-cols-1"
        )}
      >
        {comparePlans.map((plan) => {
          const meta = getMarketing(plan);
          const isFeatured = plan.highlighted;
          const showAnnual =
            billingCycle === "annually" && Boolean(plan.has_annual_price);
          const priceLabel = showAnnual
            ? plan.price_display_annual || plan.price_display
            : plan.price_display;
          const canCheckout = Boolean(plan.stripe_price_id);
          const href = canCheckout
            ? `${plan.cta_href || "/dashboard/plano"}?plan=${encodeURIComponent(plan.slug)}&cycle=${billingCycle}`
            : plan.cta_href || "/criar-conta";
          const bullets = (plan.features || []).slice(0, 5);

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col transition-all duration-300",
                isFeatured
                  ? "z-10 scale-[1.02] shadow-elevated-lg ring-2 ring-primary/30"
                  : "hover:border-primary/40 hover:shadow-elevated-lg"
              )}
            >
              {isFeatured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                    Mais popular
                  </span>
                </div>
              )}

              <CardHeader className={cn("pb-4", isFeatured && "pt-8")}>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="mt-2 text-base font-semibold text-primary">{meta.promise}</p>
                <CardDescription className="mt-1">{meta.idealFor}</CardDescription>
                <div className="mt-4">
                  <p className="text-3xl font-bold tracking-tight text-foreground">
                    {priceLabel || "—"}
                  </p>
                  {showAnnual && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cobrado anualmente
                      {plan.price_display ? (
                        <span className="ml-1 line-through opacity-70">{plan.price_display}</span>
                      ) : null}
                    </p>
                  )}
                  {!showAnnual && plan.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 pt-0">
                <ul className="space-y-2.5">
                  {bullets.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-3 w-3 text-primary" strokeWidth={3} />
                      </span>
                      <span className="leading-snug text-foreground/85">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  asChild
                  className="h-11 w-full font-medium"
                  variant={isFeatured ? "default" : "outline"}
                  size="lg"
                >
                  <Link href={href}>{plan.cta_text || "Começar"}</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {comparePlans.length >= 2 && (
        <section aria-label="Comparação detalhada de recursos" className="hidden md:block">
          <h3 className="mb-6 text-center text-2xl font-bold text-foreground">
            Compare os planos
          </h3>
          <div className="overflow-x-auto rounded-xl border border-border/60 shadow-sm">
            <table className="min-w-full divide-y divide-border/80">
              <thead>
                <tr className="bg-muted/30">
                  <th
                    scope="col"
                    className="w-[220px] px-5 py-4 text-left text-sm font-semibold text-foreground/80"
                  >
                    Recurso
                  </th>
                  {comparePlans.map((plan) => (
                    <th
                      key={`th-${plan.id}`}
                      scope="col"
                      className={cn(
                        "px-5 py-4 text-center text-sm font-semibold text-foreground/80",
                        plan.highlighted && "bg-primary/10"
                      )}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {COMPARISON_SECTIONS.map((section) => (
                  <React.Fragment key={section.title}>
                    <tr className="bg-muted/20">
                      <td
                        colSpan={comparePlans.length + 1}
                        className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-primary"
                      >
                        {section.title}
                      </td>
                    </tr>
                    {section.rows.map((row) => (
                      <tr key={row.name} className="hover:bg-accent/10">
                        <td className="px-5 py-3 text-left text-sm font-medium text-foreground/90">
                          {row.name}
                        </td>
                        {comparePlans.map((plan) => {
                          const cell = row.values[plan.slug] ?? false;
                          return (
                            <td
                              key={`${plan.id}-${row.name}`}
                              className={cn(
                                "px-5 py-3 text-center",
                                plan.highlighted && "bg-primary/5"
                              )}
                            >
                              <ComparisonCellView value={cell} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {corporativo && (
        <div className="mx-auto max-w-3xl rounded-xl border border-border/60 bg-muted/20 px-6 py-8 text-center sm:px-10">
          <h3 className="text-xl font-semibold text-foreground">{corporativo.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {getMarketing(corporativo).idealFor}{" "}
            {corporativo.description || "Configuração personalizada, onboarding assistido e suporte dedicado."}
          </p>
          <p className="mt-3 text-2xl font-bold text-foreground">
            {corporativo.price_display || "Sob consulta"}
          </p>
          <Button asChild className="mt-5" variant="outline" size="lg">
            <Link href={corporativo.cta_href || "/criar-conta"}>
              {corporativo.cta_text || "Falar com vendas"}
            </Link>
          </Button>
        </div>
      )}

      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col items-center justify-center gap-6 text-sm text-muted-foreground sm:flex-row sm:gap-10">
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary/70" />
            Sem fidelidade
          </span>
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary/70" />
            Cancele quando quiser
          </span>
        </div>
        <p className="mx-auto mt-4 max-w-xl text-center text-xs text-muted-foreground">
          Mensagens oficiais do WhatsApp são cobradas diretamente pela Meta conforme o volume
          utilizado pela clínica.
        </p>
      </div>
    </div>
  );
}
