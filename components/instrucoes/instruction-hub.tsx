"use client";

import Link from "next/link";
import { Clock, ArrowRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { INSTRUCTION_MODULES } from "@/lib/instrucoes/modules";
import { RevealSection } from "./use-reveal-on-scroll";

export function InstructionHub() {
  return (
    <div className="min-h-full bg-gradient-to-b from-muted/20 via-background to-background">
      <div className="border-b border-border/40 bg-gradient-to-br from-primary/10 via-primary/5 to-background px-6 py-10 md:px-10 md:py-14 lg:px-14">
        <RevealSection>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
            Central de aprendizado
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Instruções
          </h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Guias visuais para entender o Flowmedi sem jargão. Comece pela jornada do lead.
          </p>
        </RevealSection>
      </div>

      <div className="px-6 py-10 md:px-10 md:py-12 lg:px-14">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
          {INSTRUCTION_MODULES.map((mod) => {
            const available = mod.status === "available";
            const inner = (
              <Card
                className={`h-full transition-all ${
                  available
                    ? "hover:border-primary/40 hover:shadow-lg cursor-pointer group"
                    : "opacity-60"
                }`}
              >
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-2 mb-4">
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
                  <h2 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                    {mod.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 flex-1 leading-relaxed">
                    {mod.description}
                  </p>
                  {available && (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-5">
                      Começar
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </CardContent>
              </Card>
            );

            return (
              <RevealSection key={mod.id}>
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
    </div>
  );
}
