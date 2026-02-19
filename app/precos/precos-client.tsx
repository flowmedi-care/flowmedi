"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Check, Sparkles } from "lucide-react";

export function PrecosClient() {
  const [proPrice, setProPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stripe/price")
      .then((res) => res.json())
      .then((data) => {
        if (data.formatted) {
          setProPrice(data.formatted);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const plans = [
    {
      name: "Starter",
      description: "Para começar",
      price: "Grátis",
      period: "",
      features: [
        "1 médico",
        "Agenda e consultas",
        "Formulários básicos",
        "Até 50 consultas/mês",
      ],
      cta: "Começar grátis",
      href: "/criar-conta",
      highlighted: false,
    },
    {
      name: "Profissional",
      description: "Clínicas em crescimento",
      price: loading ? "Carregando..." : proPrice || "R$ 99",
      period: "mês",
      features: [
        "Múltiplos médicos",
        "WhatsApp transacional",
        "E-mail automático",
        "Formulários ilimitados",
      ],
      cta: "Assinar Pro",
      href: "/dashboard/plano",
      highlighted: true,
    },
  ];

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <Card
            key={plan.name}
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
                {plan.description}
              </p>
              <h2 className="text-xl font-semibold text-foreground">
                {plan.name}
              </h2>
              <p className="text-3xl font-bold text-foreground">
                {plan.price}
                {plan.period && (
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}/ {plan.period}
                  </span>
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-sm text-muted-foreground"
                  >
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.href} className="block">
                <Button
                  className="w-full h-11"
                  variant={plan.highlighted ? "default" : "outline"}
                  size="lg"
                >
                  {plan.cta}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Sem fidelidade. Cancele quando quiser.
      </p>
    </>
  );
}
