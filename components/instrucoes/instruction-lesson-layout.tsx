"use client";

import Link from "next/link";
import { Clock, ChevronRight } from "lucide-react";
import type { LessonSection } from "@/lib/instrucoes/crm-journey-lesson";

type InstructionLessonLayoutProps = {
  title: string;
  subtitle: string;
  durationMin?: number;
  sections: LessonSection[];
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
};

export function InstructionLessonLayout({
  title,
  subtitle,
  durationMin,
  sections,
  backHref = "/dashboard/instrucoes",
  backLabel = "Instruções",
  children,
}: InstructionLessonLayoutProps) {
  return (
    <div className="min-h-full bg-gradient-to-b from-muted/20 via-background to-background">
      <div className="flex flex-col xl:flex-row gap-0 xl:gap-0">
        <aside className="hidden xl:block w-56 shrink-0 border-r border-border/40 bg-background/80 backdrop-blur-sm">
          <nav className="sticky top-0 p-6 space-y-1 max-h-screen overflow-y-auto">
            <Link
              href={backHref}
              className="text-xs text-muted-foreground hover:text-foreground mb-5 inline-flex items-center gap-1"
            >
              ← {backLabel}
            </Link>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">
              Nesta lição
            </p>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <header
            id="intro"
            className="scroll-mt-0 border-b border-border/40 bg-gradient-to-br from-primary/10 via-primary/5 to-background px-6 py-10 md:px-10 md:py-14 lg:px-14"
          >
            <Link
              href={backHref}
              className="xl:hidden text-xs text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
            >
              ← {backLabel}
            </Link>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              Lição
            </p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight max-w-4xl">
              {title}
            </h1>
            <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-3xl leading-relaxed">
              {subtitle}
            </p>
            {durationMin != null && (
              <p className="mt-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                ~{durationMin} min de leitura
              </p>
            )}
          </header>

          <div className="px-6 py-10 md:px-10 md:py-12 lg:px-14 space-y-16">
            {children}

            <footer className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              Conteúdo em evolução — novos módulos serão adicionados em{" "}
              <Link href="/dashboard/instrucoes" className="text-primary hover:underline">
                Instruções
              </Link>
              .
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LessonSectionBlock({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          {title}
          <ChevronRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
        </h2>
        {description && (
          <p className="text-base text-muted-foreground mt-2 max-w-3xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
