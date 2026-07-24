import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { TrustStatsBar } from "@/components/landing/trust-stats-bar";
import { PricingFaq } from "@/components/landing/pricing-faq";
import { PricingOutcomes } from "@/components/landing/pricing-outcomes";
import { CtaBand } from "@/components/landing/cta-band";
import { PrecosClient } from "./precos-client";

export const metadata = {
  title: "Preços — FlowMed",
  description:
    "Organize, automatize e escale sua clínica com IA. Planos sem fidelidade — cancele quando quiser.",
};

export default function PrecosPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="relative pb-10 pt-16 md:pb-12 md:pt-24">
            <div className="absolute inset-0 opacity-100 gradient-mesh" />
            <div className="container relative mx-auto px-4">
              <div className="mx-auto max-w-3xl text-center">
                <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
                  Planos
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl md:leading-[1.15]">
                  Da organização à operação completa com IA
                </h1>
                <p className="mt-4 text-lg text-muted-foreground sm:text-xl">
                  Um hub operacional para sua clínica crescer com clareza — não só uma agenda.
                  Sem fidelidade, cancele quando quiser.
                </p>
              </div>
            </div>
          </div>

          <TrustStatsBar variant="compact" className="border-t-0" />

          <div className="container relative mx-auto space-y-14 px-4 py-12 md:space-y-16 md:py-16">
            <PricingOutcomes />
            <PrecosClient />
          </div>
        </section>

        <PricingFaq />
        <CtaBand variant="primary" />
      </main>

      <PublicFooter />
    </div>
  );
}
