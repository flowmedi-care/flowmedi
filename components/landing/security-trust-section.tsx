import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SECURITY_CARDS } from "@/lib/landing/content";
import { PublicSectionHeader } from "@/components/landing/public-section-header";
import { Button } from "@/components/ui/button";

export function SecurityTrustSection() {
  return (
    <section className="py-20 md:py-28" id="seguranca">
      <div className="container mx-auto px-4">
        <PublicSectionHeader
          eyebrow="Segurança"
          title="Mais tranquilidade para o seu negócio"
          description="Proteção de dados pensada para clínicas, com conformidade LGPD e documentação completa."
          className="mb-14"
        />

        <div className="mx-auto max-w-6xl grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SECURITY_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="surface-elevated p-6 transition-all hover:border-primary/30 hover:shadow-elevated-lg"
              >
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{card.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link href="/seguranca">
            <Button variant="outline" size="lg">
              Conheça nossa segurança
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
