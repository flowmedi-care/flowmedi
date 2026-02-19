import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { PrecosClient } from "./precos-client";

export default function PrecosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="gradient-mesh py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center mb-12">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                Planos para sua clínica
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Comece grátis. Assine o Profissional quando precisar de mais recursos.
              </p>
            </div>

            <PrecosClient />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
