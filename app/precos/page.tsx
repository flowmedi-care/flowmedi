import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Check } from "lucide-react";

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
    price: "Em breve",
    period: "",
    features: [
      "Múltiplos médicos",
      "WhatsApp transacional",
      "E-mail automático",
      "Formulários ilimitados",
    ],
    cta: "Avisar quando lançar",
    href: "#",
    highlighted: true,
  },
];

export default function PrecosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg text-foreground">
            FlowMedi
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/precos"
              className="text-sm font-medium text-foreground"
            >
              Preços
            </Link>
            <Link href="/entrar">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link href="/criar-conta">
              <Button>Começar grátis</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-foreground">
            Planos para sua clínica
          </h1>
          <p className="mt-2 text-muted-foreground">
            Comece grátis. Recursos avançados em breve.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.highlighted ? "border-primary shadow-md" : ""}
            >
              <CardHeader>
                <p className="text-sm font-medium text-primary">
                  {plan.description}
                </p>
                <h2 className="text-xl font-semibold text-foreground">
                  {plan.name}
                </h2>
                <p className="text-2xl font-bold text-foreground">
                  {plan.price}
                  {plan.period && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / {plan.period}
                    </span>
                  )}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className="block">
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
