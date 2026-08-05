"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FlowmediLogo } from "@/components/flowmedi-logo";
import { CLINICAS_COPY } from "@/lib/landing/clinicas-content";
import { useClinicasAnalytics } from "./analytics-provider";

export function ClinicasHeader() {
  const { trackCta, openWhatsApp, copyVariant } = useClinicasAnalytics();
  const label = CLINICAS_COPY[copyVariant].primaryCta;

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <FlowmediLogo size="sm" href="/" />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <a href="#como-funciona" className="transition hover:text-foreground">
            Como funciona
          </a>
          <a href="#demonstracao" className="transition hover:text-foreground">
            Demonstração
          </a>
          <a href="#faq" className="transition hover:text-foreground">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden text-sm text-muted-foreground transition hover:text-foreground md:inline"
          >
            Site
          </Link>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90"
            onClick={() => {
              trackCta({
                location: "header",
                variant: "primary",
                text: label,
              });
              void openWhatsApp({ buttonLocation: "header" });
            }}
          >
            {label}
          </Button>
        </div>
      </div>
    </header>
  );
}
