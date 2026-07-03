import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { PublicSectionHeader } from "@/components/landing/public-section-header";
import { FeatureGrid } from "@/components/landing/feature-explorer";
import { CtaBand } from "@/components/landing/cta-band";

export const metadata = {
  title: "Recursos — FlowMed",
  description:
    "Conheça todos os recursos do FlowMed: agenda, formulários clínicos, site público, agendamento online, comunicação e LGPD.",
};

export default function RecursosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 gradient-mesh opacity-100" />
          <div className="container relative mx-auto px-4 py-16 md:py-24">
            <PublicSectionHeader
              eyebrow="Recursos"
              title="Mais de um sistema — uma plataforma completa"
              description="Funcionalidades desenvolvidas para modernizar e simplificar a operação da sua clínica em todas as áreas."
            />
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="container mx-auto px-4">
            <FeatureGrid />
          </div>
        </section>

        <section className="border-t border-border bg-muted/20 py-16">
          <div className="container mx-auto px-4 text-center">
            <p className="text-muted-foreground mb-6">
              Quer ver tudo funcionando na prática?
            </p>
            <Link
              href="/criar-conta"
              className="text-primary font-semibold hover:underline underline-offset-2"
            >
              Crie sua conta gratuita →
            </Link>
          </div>
        </section>

        <CtaBand />
      </main>

      <PublicFooter />
    </div>
  );
}
