import type { Metadata } from "next";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { SugestoesClient } from "./sugestoes-client";

export const metadata: Metadata = {
  title: "Sugestões & Melhorias | FlowMedi",
  description:
    "Envie sugestões e melhorias para o produto. Edição e exclusão disponíveis por 5 minutos, sem login.",
};

export default function SugestoesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border bg-muted/20">
          <div className="absolute inset-0 gradient-mesh opacity-80" />
          <div className="container relative mx-auto px-4 py-14 md:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                Sugestões & Melhorias
              </h1>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">
                Sua ideia vira evolução de produto. Envie uma sugestão em poucos segundos.
              </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-10 md:py-14">
          <SugestoesClient />
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
