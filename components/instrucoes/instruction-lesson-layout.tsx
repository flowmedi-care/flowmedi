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
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
      <aside className="hidden lg:block w-48 shrink-0">
        <nav className="sticky top-6 space-y-1">
          <Link
            href={backHref}
            className="text-xs text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
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

      <div className="flex-1 min-w-0 space-y-10">
        <header
          id="intro"
          className="scroll-mt-6 rounded-2xl border border-border/60 bg-gradient-to-br from-primary/8 via-background to-background p-6 md:p-8"
        >
          <Link
            href={backHref}
            className="lg:hidden text-xs text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1"
          >
            ← {backLabel}
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
            Lição
          </p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">{subtitle}</p>
          {durationMin != null && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              ~{durationMin} min de leitura
            </p>
          )}
        </header>

        {children}

        <footer className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Conteúdo em evolução — novos módulos serão adicionados em{" "}
          <Link href="/dashboard/instrucoes" className="text-primary hover:underline">
            Instruções
          </Link>
          .
        </footer>
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
    <section id={id} className="scroll-mt-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          {title}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}
