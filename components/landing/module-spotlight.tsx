import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { MODULE_SPOTLIGHTS } from "@/lib/landing/content";
import { Button } from "@/components/ui/button";
import { PublicSectionHeader } from "@/components/landing/public-section-header";
import { cn } from "@/lib/utils";

export function ModuleSpotlights() {
  return (
    <section className="py-20 md:py-28 bg-muted/20 border-y border-border">
      <div className="container mx-auto px-4">
        <PublicSectionHeader
          eyebrow="Destaques"
          title="Recursos que fazem a diferença"
          description="Módulos pensados para a realidade das clínicas brasileiras."
          className="mb-16"
        />

        <div className="mx-auto max-w-6xl space-y-20 md:space-y-28">
          {MODULE_SPOTLIGHTS.map((spotlight, index) => {
            const reversed = index % 2 === 1;
            return (
              <div
                key={spotlight.id}
                className={cn(
                  "grid gap-10 lg:gap-16 items-center lg:grid-cols-2",
                  reversed && "lg:[&>*:first-child]:order-2"
                )}
              >
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                    {spotlight.eyebrow}
                  </p>
                  <h3 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {spotlight.title}
                  </h3>
                  <p className="mt-4 text-muted-foreground leading-relaxed text-lg">
                    {spotlight.description}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {spotlight.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center gap-3 text-sm text-foreground">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <Link href={spotlight.cta.href} className="mt-8 inline-block">
                    <Button variant="outline" size="lg">
                      {spotlight.cta.label}
                    </Button>
                  </Link>
                </div>
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-card shadow-elevated-lg">
                  <Image
                    src={spotlight.image}
                    alt={spotlight.imageAlt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
