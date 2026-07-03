import { CheckCircle2, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { PERSONAS } from "@/lib/landing/content";
import { Button } from "@/components/ui/button";
import { PublicSectionHeader } from "@/components/landing/public-section-header";

export function PersonasSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <PublicSectionHeader
          eyebrow="Equipe"
          title="Simples para toda a equipe"
          description="Cada perfil com o que precisa. Admin configura, Secretário(a) agenda e envia, Profissional acompanha."
          className="mb-14"
        />

        <div className="mx-auto max-w-6xl grid gap-6 md:grid-cols-3">
          {PERSONAS.map((persona) => (
            <article
              key={persona.id}
              className="surface-elevated p-6 md:p-8 transition-all hover:border-primary/30 hover:shadow-elevated-lg"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{persona.role}</h3>
                  <p className="text-sm text-muted-foreground">{persona.subtitle}</p>
                </div>
              </div>
              <ul className="space-y-2.5">
                {persona.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/entrar">
            <Button size="lg" variant="secondary">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Acessar o dashboard
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
