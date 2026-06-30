"use client";

import Link from "next/link";
import { Clock, ArrowRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { INSTRUCTION_MODULES } from "@/lib/instrucoes/modules";
import { RevealSection } from "./use-reveal-on-scroll";

export function InstructionHub() {
  return (
    <div className="space-y-8">
      <RevealSection>
        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/8 via-background to-background p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
            Central de aprendizado
          </p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Instruções
          </h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Guias visuais para entender o fluxo do Flowmedi. Comece pela jornada do lead e
            explore os módulos conforme forem publicados.
          </p>
        </div>
      </RevealSection>

      <div className="grid gap-4 sm:grid-cols-2">
        {INSTRUCTION_MODULES.map((mod, i) => {
          const available = mod.status === "available";
          const inner = (
            <Card
              className={`h-full transition-all ${
                available
                  ? "hover:border-primary/40 hover:shadow-md cursor-pointer group"
                  : "opacity-60"
              }`}
            >
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <Badge variant={available ? "default" : "secondary"}>
                    {available ? "Disponível" : "Em breve"}
                  </Badge>
                  {mod.durationMin && available && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {mod.durationMin} min
                    </span>
                  )}
                  {!available && <Lock className="h-4 w-4 text-muted-foreground" />}
                </div>
                <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {mod.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-2 flex-1">{mod.description}</p>
                {available && (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-4">
                    Começar
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </CardContent>
            </Card>
          );

          return (
            <RevealSection key={mod.id} className={i % 2 === 1 ? "sm:mt-4" : ""}>
              {available ? (
                <Link href={mod.href} className="block h-full">
                  {inner}
                </Link>
              ) : (
                <div className="h-full">{inner}</div>
              )}
            </RevealSection>
          );
        })}
      </div>
    </div>
  );
}
