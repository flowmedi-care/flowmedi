"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { CLINICAS_COPY } from "@/lib/landing/clinicas-content";
import { useClinicasAnalytics } from "./analytics-provider";
import { useTrackedSection } from "./use-tracked-section";

export function ClinicasHero() {
  const { trackCta, openWhatsApp, copyVariant } = useClinicasAnalytics();
  const copy = CLINICAS_COPY[copyVariant];
  const ref = useTrackedSection("hero");

  return (
    <section
      ref={ref}
      className="relative overflow-hidden border-b border-border/60"
    >
      <div className="pointer-events-none absolute inset-0 gradient-mesh opacity-80" />
      <div className="container relative mx-auto grid gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:gap-12 md:py-24">
        <div className="max-w-xl">
          <p className="mb-3 text-sm font-medium tracking-wide text-primary">
            FlowMed
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
            {copy.headline}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {copy.subheadline}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="h-12 px-6 text-base"
              onClick={() => {
                trackCta({
                  location: "hero",
                  variant: "primary",
                  text: copy.primaryCta,
                  heroKind: "hero_cta",
                });
                void openWhatsApp({ buttonLocation: "hero" });
              }}
            >
              {copy.primaryCta}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-6 text-base"
              onClick={() => {
                trackCta({
                  location: "hero",
                  variant: "secondary",
                  text: copy.secondaryCta,
                  heroKind: "hero_secondary",
                });
                document
                  .getElementById("como-funciona")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {copy.secondaryCta}
            </Button>
          </div>
        </div>

        <button
          type="button"
          className="group relative mx-auto w-full max-w-lg overflow-hidden rounded-xl border border-border/70 bg-card shadow-[var(--shadow-lg)] transition hover:shadow-[var(--shadow-xl)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            trackCta({
              location: "hero",
              variant: "secondary",
              text: "hero_image",
              heroKind: "hero_image",
            });
            document
              .getElementById("demonstracao")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          aria-label="Ver demonstração do sistema"
        >
          <Image
            src="/landing/screen-dashboard.png"
            alt="Painel FlowMed — visão geral da clínica"
            width={960}
            height={640}
            className="h-auto w-full object-cover object-top transition duration-500 group-hover:scale-[1.02]"
            priority
          />
        </button>
      </div>
    </section>
  );
}
