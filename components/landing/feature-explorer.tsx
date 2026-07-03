"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { LANDING_FEATURES } from "@/lib/landing/content";
import { PublicSectionHeader } from "@/components/landing/public-section-header";
import { cn } from "@/lib/utils";

interface FeatureExplorerProps {
  showHeader?: boolean;
  className?: string;
}

export function FeatureExplorer({ showHeader = true, className }: FeatureExplorerProps) {
  const [activeId, setActiveId] = useState(LANDING_FEATURES[0].id);
  const active = LANDING_FEATURES.find((f) => f.id === activeId) ?? LANDING_FEATURES[0];
  const ActiveIcon = active.icon;

  return (
    <section className={cn("py-20 md:py-28", className)} id="recursos">
      <div className="container mx-auto px-4">
        {showHeader && (
          <PublicSectionHeader
            eyebrow="Plataforma"
            title="Tudo que sua clínica precisa"
            description="Módulos integrados para modernizar e simplificar a operação em todas as áreas."
            className="mb-14"
          />
        )}

        <div className="mx-auto max-w-6xl grid gap-8 lg:grid-cols-[320px_1fr] lg:gap-12">
          <nav className="flex flex-col gap-1" aria-label="Recursos da plataforma">
            {LANDING_FEATURES.map((feature) => {
              const Icon = feature.icon;
              const isActive = feature.id === activeId;
              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => setActiveId(feature.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl px-4 py-3.5 text-left transition-all duration-200",
                    isActive
                      ? "bg-primary/10 border border-primary/20 shadow-sm"
                      : "border border-transparent hover:bg-muted/60"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("font-semibold text-sm", isActive ? "text-foreground" : "text-foreground/80")}>
                      {feature.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>

          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="surface-elevated rounded-2xl border border-border p-8 md:p-10 shadow-elevated-lg"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ActiveIcon className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">{active.title}</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed text-lg">{active.description}</p>
              {active.bullets && (
                <ul className="mt-6 space-y-3">
                  {active.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-3 text-sm text-foreground">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto", className)}>
      {LANDING_FEATURES.map((feature) => {
        const Icon = feature.icon;
        return (
          <article
            key={feature.id}
            id={feature.id}
            className="group surface-elevated p-6 transition-all hover:border-primary/30 hover:shadow-elevated-lg scroll-mt-24"
          >
            <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-lg">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            {feature.bullets && (
              <ul className="mt-4 space-y-2">
                {feature.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 shrink-0 text-primary" />
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}
