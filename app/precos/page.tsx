import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { PricingFaq } from "@/components/landing/pricing-faq";
import { PrecosClient } from "./precos-client";

export const metadata = {
  title: "Preços — FlowMed",
  description:
    "Uma plataforma para organizar, atender e crescer sua clínica. Comece gratuitamente, sem fidelidade — cancele quando quiser.",
};

export default function PrecosPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="relative pb-6 pt-16 md:pb-8 md:pt-24">
            <div className="absolute inset-0 opacity-100 gradient-mesh" />
            <div className="container relative mx-auto px-4">
              <div className="mx-auto max-w-3xl text-center">
                <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
                  Preços
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl md:leading-[1.15]">
                  Uma plataforma que organiza, atende e cresce sua clínica.
                </h1>
                <p className="mt-4 text-lg text-muted-foreground sm:text-xl">
                  Escolha o plano ideal para sua clínica. Comece gratuitamente, sem fidelidade e
                  cancele quando quiser.
                </p>
              </div>
            </div>
          </div>

          <div className="container relative mx-auto px-4 py-12 md:py-16">
            <PrecosClient />
          </div>
        </section>

        <PricingFaq />
      </main>

      <PublicFooter />
    </div>
  );
}
