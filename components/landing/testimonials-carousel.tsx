"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { TESTIMONIALS } from "@/lib/landing/content";
import { PublicSectionHeader } from "@/components/landing/public-section-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TestimonialsCarousel() {
  const [index, setIndex] = useState(0);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % TESTIMONIALS.length);
  }, []);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 8000);
    return () => clearInterval(timer);
  }, [next]);

  const current = TESTIMONIALS[index];

  return (
    <section className="py-20 md:py-28 bg-muted/20 border-y border-border">
      <div className="container mx-auto px-4">
        <PublicSectionHeader
          eyebrow="Depoimentos"
          title="Quem usa FlowMed"
          description="Clínicas e consultórios que simplificaram sua operação com a plataforma."
          className="mb-14"
        />

        <div className="mx-auto max-w-3xl">
          <article className="surface-elevated relative rounded-2xl border border-border p-8 md:p-12 shadow-elevated-lg text-center">
            <Quote className="mx-auto h-8 w-8 text-primary/40 mb-6" aria-hidden />
            <blockquote className="text-lg md:text-xl leading-relaxed text-foreground font-medium">
              &ldquo;{current.quote}&rdquo;
            </blockquote>
            <footer className="mt-8">
              <p className="font-semibold text-foreground">{current.author}</p>
              <p className="text-sm text-muted-foreground">
                {current.role} — {current.clinic}
              </p>
            </footer>

            <div className="mt-8 flex items-center justify-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={prev}
                aria-label="Depoimento anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex gap-2" role="tablist" aria-label="Depoimentos">
                {TESTIMONIALS.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Depoimento ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      i === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={next}
                aria-label="Próximo depoimento"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
