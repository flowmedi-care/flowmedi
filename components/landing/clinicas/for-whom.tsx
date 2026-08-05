"use client";

import { Check } from "lucide-react";
import { FOR_WHOM } from "@/lib/landing/clinicas-content";

export function ClinicasForWhom() {
  return (
    <section className="border-b border-border/60 bg-muted/20 py-16 md:py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Para quem é
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Feito para clínicas que vivem de agenda, WhatsApp e relacionamento.
        </p>
        <ul className="mx-auto mt-10 flex max-w-2xl flex-wrap justify-center gap-3">
          {FOR_WHOM.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-4 py-2 text-sm text-foreground"
            >
              <Check className="h-4 w-4 text-primary" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
