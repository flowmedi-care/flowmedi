import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { PrecosClient } from "./precos-client";

export default function PrecosPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* Hero */}
          <div className="relative pt-16 pb-12 md:pt-24 md:pb-16">
            <div className="absolute inset-0 gradient-mesh opacity-100" />
            <div className="container relative mx-auto px-4">
              <div className="mx-auto max-w-3xl text-center">
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl md:leading-[1.15]">
                  Escolha o plano ideal para sua clínica
                </h1>
                <p className="mt-4 text-lg text-muted-foreground sm:text-xl">
                  De consultório a clínica multiunidade. Sem fidelidade, cancele quando quiser.
                </p>
              </div>
            </div>
          </div>

          {/* Pricing cards */}
          <div className="container relative mx-auto px-4 pb-20 md:pb-28">
            <PrecosClient />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
